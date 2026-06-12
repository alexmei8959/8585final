import re
import copy
import opencc
import logging

# 初始化日誌器
logger = logging.getLogger(__name__)


class OCRParser:
    """
    基於字典結構的 OCR 解析器。
    支援：動態 Header (User Info) -> Questions (子題目/子選項) -> Footer。
    """

    def __init__(self, config: dict):
        logger.info("Initializing OCRParser (Fixed Layout Mode)...")
        self.raw_config = copy.deepcopy(config)
        self.questions_def = self.raw_config.get('questions', {})
        self.header = self.raw_config.get('header', {})
        self.global_tables = self.raw_config.get('global_tables', [])
        self.footer = self.raw_config.get('footer', {})

        self.symbol_checked = "■"
        self.symbol_unchecked = "□"
        self.symbol_unchecked_large = "口"
        self.threshold = 0.20

        try:
            self.cc = opencc.OpenCC('s2tw')
        except Exception:
            self.cc = None

        self.current_qid_idx = 0
        self.qid_list = sorted(self.questions_def.keys(), key=lambda x: int(x) if x.isdigit() else 999)
        self.max_question_num = len(self.qid_list)

        self._initialize_results()

    def _initialize_results(self):
        self.questions_result = copy.deepcopy(self.raw_config)
        # 初始化 User Info 容器
        if 'user_info' not in self.questions_result['header']:
            self.questions_result['header']['user_info'] = {}

        # 清理標題中的前綴數字，避免輸出重複 (1. 1.)
        for qid in self.questions_result.get('questions', {}):
            q = self.questions_result['questions'][qid]
            if 'question' in q:
                q['question'] = self._clean_text(q['question'])
            if 'sub_questions' in q:
                for sub in q['sub_questions']:
                    if 'question' in sub:
                        sub['question'] = self._clean_text(sub['question'])

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.replace(self.symbol_unchecked, "").replace(self.symbol_unchecked_large, "").replace(self.symbol_checked, "")
        # 移除前導數字與常見分隔符號
        text = re.sub(r'^[（(]?\d+[.．)）\s]*', '', text.strip())
        return text.strip()

    def calculate_jaccard_similarity(self, s1: str, s2: str) -> float:
        s1_clean = self._clean_text(s1)
        s2_clean = self._clean_text(s2)
        set1, set2 = set(s1_clean), set(s2_clean)
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union else 1.0

    def get_underline_ans(self, template: str, fill: str) -> str:
        if "_" not in template:
            return ""
        # 移除模板中的子選項標記 %1
        template = re.sub(r'%\d+', '', template)
        parts = template.split("_")
        front = self._clean_text(parts[0])
        back = self._clean_text(parts[1]) if len(parts) > 1 else ""
        ans = fill
        if front:
            idx = ans.find(front)
            if idx != -1:
                ans = ans[idx + len(front):]
        if back:
            idx = ans.find(back)
            if idx != -1:
                ans = ans[:idx]
        return ans.strip()

    def parse(self, texts: list):
        """主解析邏輯：Header -> Questions -> Footer"""
        processed_lines = []
        for t in texts:
            val = t.get('text', '') if isinstance(t, dict) else str(t)
            if self.cc: val = self.cc.convert(val)
            processed_lines.append(val)

        for line in processed_lines:
            line = line.strip()
            if not line: continue

            # 1. 處理最上方的 User Info (動態偵測)
            if self.current_qid_idx == 0:
                self._match_user_info(line)

            # 處理 Header 內定義的 Fields (如章節標題)
            for field in self.questions_result['header'].get('fields', []):
                if not field.get('enabled'): continue
                label = field.get('label', '')
                if self.calculate_jaccard_similarity(label, line) > 0.7 or self._clean_text(label) in self._clean_text(line):
                    field['detected'] = True

            # 2. 處理 Questions (窗口比對)
            for i in range(self.current_qid_idx, min(self.current_qid_idx + 5, self.max_question_num)):
                qid = self.qid_list[i]
                q_def = self.questions_def[qid]
                q_res = self.questions_result['questions'][qid]

                title = q_def.get('question', '')
                if self.calculate_jaccard_similarity(title, line) > 0.5 or self._clean_text(title) in self._clean_text(line):
                    self.current_qid_idx = i

                if i == self.current_qid_idx:
                    self._parse_node_recursive(q_res, q_def, line)

            # 3. 處理 Footer
            for field in self.questions_result['footer'].get('fields', []):
                if not field.get('enabled'): continue
                label = field.get('label', '')
                if self._clean_text(label) in self._clean_text(line):
                    field['detected'] = True

        return self.questions_result

    def _match_user_info(self, line):
        """
        動態提取表頭欄位並 Mapping 至前端欄位名稱。
        """
        info_map = self.questions_result['header']['user_info']

        # 定義 Mapping 規則：前端鍵值對應的多個可能的 OCR 關鍵字
        mapping_rules = {
            "patient_name": ["兒童姓名", "患者姓名", "姓名"],
            "parent_name": ["家長姓名", "填表人", "父/母姓名", "監護人", "簽名處姓名"],
            "relationship": ["關係", "身分"],
            "phone": ["電話", "聯絡電話", "手機", "行動電話"],
            "email": ["電子郵件", "Email", "E-mail 地址", "E-mail"],
            "birthday": ["出生日期", "生日", "出生"],
            "address": ["聯絡地址", "通訊地址", "戶籍地址", "地址"],
            "medical_record_no": ["病歷號", "病歷號碼"],
            "visit_date": ["看診日", "就醫日期"]
        }

        # 遍歷規則進行匹配
        for field_key, keywords in mapping_rules.items():
            for kw in keywords:
                if kw in line:
                    # 提取冒號後的內容或底線內容
                    val = ""
                    if '：' in line or ':' in line:
                        val = re.split(r'[：:]', line)[-1].strip()
                    elif "_" in line:
                        parts = line.split(kw)
                        if len(parts) > 1:
                            val = parts[-1].replace("_", "").strip()
                    else:
                        parts = line.split(kw)
                        if len(parts) > 1:
                            val = parts[-1].strip()

                    if val:
                        # 如果該欄位尚未有值，或新值更長（通常更完整），則寫入
                        if not info_map.get(field_key) or len(val) > len(info_map.get(field_key)):
                            info_map[field_key] = val
                        break

    def _parse_node_recursive(self, res, config, line):
        """遞迴解析，支援子題目、子選項與填空"""
        line_clean = self._clean_text(line)

        # A. 處理填空
        title = config.get('question', '')
        if "_" in title:
            ans = self.get_underline_ans(title, line)
            if ans: res['value'] = ans
        elif config.get('ui_type') == 'input' and self._clean_text(title) in line_clean:
            res['value'] = self._extract_suffix_val(line_clean, self._clean_text(title), config.get('suffix', ''))

        # B. 處理選項
        options = config.get('options', [])
        if options:
            for opt in options:
                label = opt.get('label', '')
                if not label: continue
                match_label = re.sub(r'%\d+', '', label)
                if self._clean_text(match_label) in line_clean or self.calculate_jaccard_similarity(match_label, line) > 0.6:
                    pos = line.find(self._clean_text(match_label)[:2])
                    if pos != -1:
                        lookback = line[max(0, pos-4):pos]
                        if self.symbol_checked in lookback or not (self.symbol_unchecked in lookback or self.symbol_unchecked_large in lookback):
                            if res.get('ui_type') == 'radio_group':
                                res['value'] = label
                            else:
                                if not isinstance(res.get('value'), list): res['value'] = []
                                if label not in res['value']: res['value'].append(label)
                            if opt.get('has_input'):
                                # 初始化 input_values 字典
                                if 'input_values' not in res:
                                    res['input_values'] = {}
                                
                                detected_val = ""
                                if "_" in label:
                                    detected_val = self.get_underline_ans(label, line)
                                else:
                                    detected_val = self._extract_suffix_val(line, self._clean_text(match_label), opt.get('input_suffix', ''))
                                
                                if detected_val:
                                    res['input_values'][label] = detected_val

        # C. 處理子選項 (sub_options_N)
        for k, v in config.items():
            if k.startswith('sub_options_') and isinstance(v, list):
                for sub_opt in v:
                    if self._clean_text(sub_opt) in line_clean:
                        pos = line.find(sub_opt)
                        lookback = line[max(0, pos-3):pos]
                        if self.symbol_checked in lookback or not (self.symbol_unchecked in lookback or self.symbol_unchecked_large in lookback):
                            if not isinstance(res.get('value'), list): res['value'] = []
                            if sub_opt not in res['value']: res['value'].append(sub_opt)

        # D. 遞迴處理子題目
        if 'sub_questions' in config:
            for i, sub_def in enumerate(config['sub_questions']):
                if 'sub_questions' in res:
                    self._parse_node_recursive(res['sub_questions'][i], sub_def, line)

        # E. 處理表格 (初步支援)
        if config.get('ui_type') == 'table':
            self._parse_table_node(res, config, line)

    def _parse_table_node(self, res, config, line):
        """
        簡易表格解析：如果行內容包含列標籤，嘗試提取其後的資訊。
        """
        table_config = config.get('config', {})
        rows = table_config.get('rows', [])
        columns = table_config.get('columns', [])
        
        line_clean = self._clean_text(line)
        
        for row in rows:
            row_label = self._clean_text(row.get('label', ''))
            if row_label and row_label in line_clean:
                if 'value' not in res or not isinstance(res['value'], dict):
                    res['value'] = {}
                if row['id'] not in res['value']:
                    res['value'][row['id']] = {}
                
                # 這裡只做最簡單的提取，複雜表格依賴 Gemini
                remaining = line_clean.split(row_label)[-1].strip()
                # 嘗試按空格或逗號分割剩餘文字填入各個欄位 (示意)
                parts = re.split(r'[\s,，]+', remaining)
                col_idx = 0
                for col in columns:
                    if col.get('readonly'): continue
                    if col_idx < len(parts):
                        res['value'][row['id']][col['label']] = parts[col_idx]
                        col_idx += 1

    def _extract_suffix_val(self, text, prefix, suffix):
        if prefix in text:
            val = text.split(prefix)[-1]
            if suffix and self._clean_text(suffix) in val:
                val = val.split(self._clean_text(suffix))[0]
            return re.sub(r'^[：:_\s]*', '', val).strip()
        return ""
