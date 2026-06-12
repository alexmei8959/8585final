from typing import Any, Union, List
import pypdfium2 as pypdfium

import io
from typing import Optional


class SimpleFileWrapper:
    """
    最小包裝，提供 .file 與 .content_type 屬性，供需要 file-like 的流程使用。
    - file: BytesIO，可供 .seek(0) 與 .read()
    - content_type: 例如 "image/png" 或 "image/jpeg"
    - name: 可選（你不需要可忽略）
    """

    def __init__(
        self,
        bio: io.BytesIO,
        content_type: Optional[str] = None,
        name: Optional[str] = None,
    ):
        if not isinstance(bio, io.BytesIO):
            raise TypeError("bio must be a io.BytesIO")
        self.file = bio
        self.content_type = content_type
        self.name = name


def process_pdf2image(
    document: Union[bytes, bytearray, memoryview, Any],
    dpi: int = 150,
    image_format: str = "PNG",
    jpeg_quality: int = 90,
) -> List[SimpleFileWrapper]:
    """
    將 PDF 每頁渲染為圖片並寫入 BytesIO，回傳具 .file 的包裝物件列表，便於 OCR 使用。
    - 不使用 password
    - 不做檔名
    - 不使用 with，改用顯式 close()，避免 TypeError
    """

    # 標準化成 bytes
    if hasattr(document, "read"):
        raw = document.read()
        try:
            document.seek(0)
        except Exception:
            pass
        pdf_bytes = bytes(raw)
    elif isinstance(document, (bytes, bytearray, memoryview)):
        pdf_bytes = bytes(document)
    else:
        raise ValueError(
            "document 必須是 bytes、bytearray、memoryview 或具 .read() 的 file-like 物件"
        )

    # 建立 PdfDocument
    try:
        doc = pypdfium.PdfDocument(pdf_bytes)
        # 若環境僅接受 file-like，改用：
        # doc = pypdfium.PdfDocument(io.BytesIO(pdf_bytes))
    except Exception as e:
        raise ValueError(f"Invalid PDF file: {e}")

    results: List[SimpleFileWrapper] = []
    scale = dpi / 72.0
    content_type = "image/png" if image_format.upper() == "PNG" else "image/jpeg"

    try:
        page_count = len(doc)
        if page_count == 0:
            raise ValueError("PDF 沒有頁面")

        for i in range(page_count):
            page = doc[i]
            try:
                bitmap = page.render(scale=scale, rotation=0)
                try:
                    pil_image = bitmap.to_pil()

                    # JPEG 不支援透明，必要時轉為 RGB
                    img_to_save = (
                        pil_image
                        if image_format.upper() != "JPEG"
                        else pil_image.convert("RGB")
                    )
                    save_kwargs = {"format": image_format.upper()}
                    if image_format.upper() == "JPEG":
                        save_kwargs.update({"quality": jpeg_quality, "optimize": True})

                    bio = io.BytesIO()
                    img_to_save.save(bio, **save_kwargs)
                    bio.seek(0)

                    # 包裝成 OCR 可讀取的物件（具 .file 與 .content_type）
                    results.append(SimpleFileWrapper(bio, content_type=content_type))
                finally:
                    try:
                        bitmap.close()
                    except Exception:
                        pass
            finally:
                try:
                    page.close()
                except Exception:
                    pass
    finally:
        try:
            doc.close()
        except Exception:
            pass

    return results
