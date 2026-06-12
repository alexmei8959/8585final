import gc
import threading

from form_manager import app_settings


class OCREngine:
    """
    引擎與客戶端管理中心。
    統一管理重量級模型 (需回收) 與 輕量級 API Client (長駐)。
    """

    _engines = {}
    _lock = threading.Lock()
    _timer = None

    # OCR 閒置回收時間
    IDLE_TIMEOUT = 300

    @classmethod
    def get_paddle_ocr(cls):
        """獲取 PaddleOCR，會觸發/重設自動回收計時器"""
        if "paddle" not in cls._engines:
            with cls._lock:
                if "paddle" not in cls._engines:
                    print("OCREngine: Loading PaddleOCR...")
                    from paddleocr import PaddleOCR

                    cls._engines["paddle"] = PaddleOCR(
                        use_doc_orientation_classify=True,
                        use_doc_unwarping=True,
                        use_textline_orientation=True,
                        lang="chinese_cht",
                    )

        # 只有使用 OCR 時才重設計時器
        cls._reset_idle_timer()
        return cls._engines["paddle"]

    @classmethod
    def get_gemini_client(cls):
        """獲取 Gemini Client，長駐記憶體，不參與回收"""
        if "gemini" not in cls._engines:
            with cls._lock:
                if "gemini" not in cls._engines:
                    print("OCREngine: Initializing Gemini Client...")
                    from google import genai

                    if not app_settings.GEMINI_OCR_API:
                        raise ValueError("GEMINI_API is not set")
                    cls._engines["gemini"] = genai.Client(api_key=app_settings.GEMINI_OCR_API)
        return cls._engines["gemini"]

    @classmethod
    def _reset_idle_timer(cls):
        with cls._lock:
            if cls._timer is not None:
                cls._timer.cancel()

            cls._timer = threading.Timer(cls.IDLE_TIMEOUT, cls._auto_cleanup)
            cls._timer.daemon = True
            cls._timer.start()

    @classmethod
    def _auto_cleanup(cls):
        """只回收佔空間的 paddle，不影響字典裡的 gemini"""
        with cls._lock:
            if "paddle" in cls._engines:
                print(
                    f"OCREngine: PaddleOCR idle for {cls.IDLE_TIMEOUT}s, releasing RAM..."
                )
                engine = cls._engines.pop("paddle")

                if hasattr(engine, "free_cache"):
                    try:
                        engine.free_cache()
                    except:
                        pass

                del engine
                gc.collect()

            cls._timer = None

    @classmethod
    def clear(cls):
        """手動清理全部實體"""
        with cls._lock:
            if cls._timer:
                cls._timer.cancel()
                cls._timer = None
            cls._engines.clear()
            gc.collect()
        print("OCREngine: All instances cleared.")
