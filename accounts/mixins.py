from django.contrib.auth.mixins import AccessMixin
from django.shortcuts import redirect

from . import app_settings

class AnonymousRequiredMixin(AccessMixin):
    """Verify that the current user is anonymous."""

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_anonymous:
            return super().dispatch(request, *args, **kwargs)
        return redirect(app_settings.LOGIN_REDIRECT_URL)


class LoginRequiredMixin(AccessMixin):
    """Verify that the current user is authenticated."""

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        return super().dispatch(request, *args, **kwargs)
