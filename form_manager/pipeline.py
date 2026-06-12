import json
import re
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

import numpy as np
from PIL import Image
from google.genai import types

from .ocr_engine import OCREngine
from .parsers import OCRParser


class BasePipeline(ABC):
    """Abstract Base Class for Document Processing Pipelines"""

    def __init__(self, parser_structure: dict):
        self.parser_structure = parser_structure

    @abstractmethod
    def run(self, files):
        pass


class PaddlePipeline(BasePipeline):
    """
    Traditional Pipeline:
    1. OCR (Image -> Text List)
    2. OCRParser (Text List -> Structured JSON)
    """

    def __init__(self, parser_structure: dict):
        super().__init__(parser_structure)
        self.parser = OCRParser(parser_structure)

    def run(self, files):
        # Step 1: Lazy loading ocr engine
        ocr_engine = OCREngine.get_paddle_ocr()

        json_results = []
        for file in files:
            # Step 2: Executing OCR
            file.file.seek(0)
            with Image.open(file.file) as img:
                MAX_SIZE = 2000
                if max(img.size) > MAX_SIZE:
                    img.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)

                # Normalize to RGB; adjust as needed (e.g., "RGBA" or keep original mode)
                img = img.convert("RGB")
                img_array = np.array(img)
                results = ocr_engine.predict(img_array)
                if results is not None:
                    # Step 3: Parse Text using Rules
                    json_result = results[0].json["res"]["rec_texts"]
                    json_results.extend(json_result)
        return self.parser.parse(json_results)


class GeminiPipeline(BasePipeline):
    """
    LLM Pipeline:
    1. Multimodal Model (Image -> Structured JSON directly)
    """

    def __init__(self, parser_structure: dict):
        super().__init__(parser_structure)
        self.prompt_template = (
            f"""
            你是資訊擷取助理。請你依照以下 JSON Schema 強制輸出「唯一的一個 JSON」，不得輸出任何多餘文字、註解、解釋、Markdown、程式碼區塊符號或其他格式。
            - 嚴格規則：
              1. 僅輸出單一 JSON 物件。
              2. 不得包含鍵以外的文字。
              3. 欄位型態與必填欄位必須符合 Schema。
              4. 若你無法確定或資料差異過大，請輸出「空的 structure」（我會在系統端檢查）。
              5. 答案連同題目回應回來，不允許修改題目。
              6. 題號如果mapping後，則在題目內不要再次顯示。
              """
            + """
          Json每個key用途
             1. 關鍵資訊語義映射 (User Info Mapping)
              請優先從圖片中識別以下「核心欄位」，並放入根目錄的 user_info 物件中。請忽略圖片上的原始中文字標籤，依據語意進行映射：
                「請嚴格遵守上述 Key 名稱。特別注意：
               2. 扁平化答案：所有辨識到的答案必須填入題目的 value 或 input_values (多項填空時) 中，禁止產生 answer 巢狀 Key。
               3. 類型自動判定：
                  - 題目文字含「可複選」-> ui_type: "checkbox_group"。
                  - 題目只有底線供填寫 -> ui_type: "input"。
                  - 題目以「表格」形式呈現 -> ui_type: "table"。
               4. 子題目嵌套：若題目下有小字號的附屬問題（如：如果是，請填寫...），請放入 sub_questions 陣列中。
               5. 選項填空：若選項中包含『其他』，務必設定 `has_input: true`。」
            
            
              ┌──────────────┬───────────────────────────────────────────────────┐
              │ 輸出 Key     │ 語意範疇 (請從圖片中尋找相關資訊)                       │
              ├──────────────┼───────────────────────────────────────────────────┤
              │ parent_name  │ 家長姓名、填表人、父/母姓名、監護人、簽名處姓名。         │
              │ relationship │ 關係、身分。                                        │
              │ phone        │ 電話、聯絡電話、手機、行動電話。                       │
              │ email        │ 電子郵件、Email、E-mail 地址。                       │
              │ patient_name │ 兒童姓名、患者姓名。                                  │
              │ birthday     │ 出生日期、生日。                                     │
              │ address      │ 聯絡地址、通訊地址、戶籍地址。                         │
              └──────────────┴───────────────────────────────────────────────────┘
            
              特別規則：一旦資訊被提取至 `user_info`，請不要將其重複放入 `questions` 或 `header` 中。
            
              ---
            
              2. JSON 結構架構 (JSON Schema Definition)
              請依照以下層級結構建構其餘資料：
            
              A. 根目錄層級 (Root Level)
            
              ┌───────────┬──────────┬─────────────────────────────────────────────────────────────────────────────────────┐
              │ Key 名稱  │ 資料型態 │ 用途說明                                                                            │
              ├───────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────┤
              │ meta      │ Object   │ 全域元數據。包含 name (表單名稱)。                                                  │
              │ header    │ Object   │ 頁首設定。包含 title_name (中)、title_en_name (英) 以及 fields (動態標題陣列)。 │
              │ footer    │ Object   │ 頁尾設定。包含 fields 陣列（通常存放通過日期、頁碼說明等）。                        │
              │ questions │ Object   │ 核心題目區。Key 為題號字串 (如 "1")，Value 為題目物件。                             │
              │ order     │ Array    │ 顯示順序。存放題號字串的陣列，決定畫面上題目的先後順序。                            │
              │ id        │ String   │ 表單的 UUID 唯一識別碼（若有）。                                                    │
              └───────────┴──────────┴─────────────────────────────────────────────────────────────────────────────────────┘
            
              B. 題目物件 (Question Object)
              ┌───────────────┬──────────┬────────────────────────────────────────────────────────────────────────────────┐
              │ Key 名稱      │ 資料型態 │ 用途說明                                                                       │
              ├───────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────┤
              │ question      │ String   │ 題目的完整正文文字。                                                           │
              │ ui_type       │ String   │ 渲染類型。可選值：radio_group, checkbox_group, input, date, table。              │
              │ required      │ Boolean  │ 是否為必填項目。                                                               │
              │ value         │ Mixed    │ 目前的答案。單選存 String；多選存 Array；簡答存 String；表格存 Object。       │
              │ config        │ Object   │ 表格專用設定。包含 headers, columns, rows (詳見下方表格說明)。                  │
              │ input_values  │ Object   │ 選項填寫內容映射。當選項有 has_input 時使用。Format: { "選項標籤": "內容" }    │
              │ suffix        │ String   │ 結尾符號。僅用於 ui_type: "input"，如：「公分」、「週」。                      │
              │ options       │ Array    │ 選項物件陣列（詳見下方 Option 說明）。                                         │
              │ sub_questions │ Array    │ 巢狀子題目。其內部的結構與此「題目物件」完全一致，支援無限層級。               │
              └───────────────┴──────────┴────────────────────────────────────────────────────────────────────────────────┘
            
              ---

              3. 表格物件說明 (Table Object Definition)
              當 `ui_type` 為 `table` 時：
              - `config.headers`: 欄位標題陣列 (例如: ["序號", "醫療院所", "就診日期"])。
              - `config.rows`: 列物件陣列 (例如: [{"id": "r1", "label": "1"}] )。
              - `config.columns`: 欄位定義陣列 (例如: [{"label": "日期", "type": "date"}] )。
              - `value`: 格式為 `{ "row_id": { "column_label": "value" } }`。

              ---
            
              4. 選項物件層級 (Option Object)
              ┌────────────────┬──────────┬───────────────────────────────────────────────────────────────────────────────┐
              │ Key 名稱       │ 資料型態 │ 用途說明                                                                      │
              ├────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────┤
              │ label          │ String   │ 選項顯示的文字（例如：「是」、「否」、「其他」）。                            │
              │ has_input      │ Boolean  │ 該選項旁是否帶有「填空底線」供使用者補充說明。                                │
              │ input_label    │ String   │ 填空前綴。當 has_input 為 true 時，顯示在底線前的微縮文字（如：「原因：」）。 │
              │ input_suffix   │ String   │ 填空後綴。當 has_input 為 true 時，顯示在底線後的單位（如：「週」、「kg」）。 │
              │ input_position │ String   │ (進階) 決定 input 相對於 label 的位置，預選值通常為 "suffix"。                │
              └────────────────┴──────────┴───────────────────────────────────────────────────────────────────────────────┘
              
              4. 動態欄位物件 (Dynamic Field Object - 用於 Header/Footer)

              ┌──────────┬──────────┬────────────────────────────────────────────────┐
              │ Key 名稱 │ 資料型態 │ 用途說明                                       │
              ├──────────┼──────────┼────────────────────────────────────────────────┤
              │ label    │ String   │ 顯示的文字內容（如：「日常照護及基本資料」）。 │
              │ enabled  │ Boolean  │ 該欄位是否啟用並顯示在畫面上。                 │
              └──────────┴──────────┴────────────────────────────────────────────────┘
               """
            + f"""
        以下是 JSON Schema（供你參考欄位與型態）：{self.parser_structure}
        
        根據上傳的內容抽取後輸出 JSON。
        """
        )

    def parse_json_strict(self, output_text: str) -> Optional[Dict[str, Any]]:
        """
        嚴格解析：嘗試將模型輸出轉為 JSON。若包含多餘前後綴文字、或不是純 JSON，直接視為失敗。
        這裡可以加一點容錯：常見情況是模型用 ```json 包起來，我們先去除這些包裝。
        """
        if not output_text:
            return None

        cleaned = output_text.strip()

        # 去除可能的 BOM
        cleaned = cleaned.lstrip("\ufeff")

        # 去除常見的 Markdown 區塊包裝（包含 ```json 與 ```）
        # 支援上中下任意有換行的情況
        fenced_block = re.match(r"^```(?:json)?\s*\n(.*)\n```$", cleaned, flags=re.S)
        if fenced_block:
            cleaned = fenced_block.group(1).strip()

        # 若模型在前後加了解說文字，嘗試抓第一個 { 到最後一個 } 的子字串
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]

        # 允許存在多餘的換行與空白，不影響 JSON.parse
        # 若 \n 出現在字串值中，也屬於合法 JSON
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return None

    def run(self, files: list):
        # Step1: Init gemini client
        client = OCREngine.get_gemini_client()

        # Step2: File read
        contents = [f"{self.prompt_template}"]
        for file in files:
            file.file.seek(0)
            file_bytes = file.file.read()
            contents.append(
                types.Part.from_bytes(
                    data=file_bytes,
                    mime_type=file.content_type,
                )
            )

        # Step2: send files and structured Json
        response = client.models.generate_content(
            model="gemini-3-flash-preview", contents=contents
        )
        data = self.parse_json_strict(response.text)
        if not data:
            return self.parser_structure

        return data


class PipelineFactory:
    _pipelines = {"paddle": PaddlePipeline, "gemini": GeminiPipeline}

    @classmethod
    def get_pipeline(cls, name: str, parser_structure: dict) -> BasePipeline:
        pipeline_class = cls._pipelines.get(name.lower())
        if not pipeline_class:
            raise ValueError(f"Unknown pipeline: {name}")
        return pipeline_class(parser_structure)
