import time

from django.utils.deprecation import MiddlewareMixin

from .threadlocals import set_current_user, clear_current_user, set_current_user_async, clear_current_user_async
from django.utils.decorators import sync_and_async_middleware
from django.conf import settings
from django.contrib.auth.views import redirect_to_login
from django.shortcuts import redirect


@sync_and_async_middleware
def CurrentUserMiddleware(get_response):
    if hasattr(get_response, "is_async") and get_response.is_async:  # Django 5.0+
        async def middleware(request):
            user = getattr(request, 'user', None)
            set_current_user_async(user if user and user.is_authenticated else None)
            response = await get_response(request)
            clear_current_user_async()
            return response

        return middleware
    else:
        def middleware(request):
            user = getattr(request, 'user', None)
            set_current_user(user if user and user.is_authenticated else None)
            response = get_response(request)
            clear_current_user()
            return response

        return middleware

