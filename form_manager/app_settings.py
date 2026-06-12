import sys
from django.conf import settings


class AppSettings:
    @property
    def GEMINI_OCR_API(self):
        default = "AIzaSyB__IX8kU4gCZrP9dj2PPOT8vVBVRrWQq4"
        return self._setting("GEMINI_OCR_API", default)

    @staticmethod
    def _setting(name, default):
        ret = getattr(settings, name, default)
        return ret if ret is not None else default


app_settings = AppSettings()
app_settings.__name__ = __name__
# noinspection PyTypeChecker
sys.modules[__name__] = app_settings
