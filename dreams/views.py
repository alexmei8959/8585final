import json
import logging

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.http import HttpResponse
from django.template.response import TemplateResponse
from django.views.decorators.csrf import csrf_exempt

from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient, Configuration, MessagingApi,
    ReplyMessageRequest, TextMessage as LineTextMessage,
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent

from accounts.models import userprofile
from django.contrib.auth import get_user_model
from form_manager.models import form_template

logger = logging.getLogger("django")
User = get_user_model()

_line_handler = WebhookHandler(settings.LINE_CHANNEL_SECRET)

# cache key prefix：記錄哪些 LINE userId 正在等待輸入電話/email
_BIND_WAITING = 'line_bind_waiting:'


def _reply(reply_token, text):
    """向 LINE 使用者回覆一則純文字訊息。"""
    cfg = Configuration(access_token=settings.LINE_CHANNEL_ACCESS_TOKEN)
    with ApiClient(cfg) as client:
        MessagingApi(client).reply_message(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[LineTextMessage(text=text)],
            )
        )


def _do_bind(line_user_id, text):
    """
    依據輸入文字（電話或 Email）將 line_user_id 寫入 userprofile。
    回傳 {'success': True} 或 {'success': False, 'error': '...'}
    """
    text = text.strip()
    profile = None

    if '@' in text:
        try:
            user = User.objects.get(email=text)
            profile = userprofile.objects.filter(user=user).first()
        except User.DoesNotExist:
            pass
    else:
        profile = userprofile.objects.filter(phone=text).first()

    if not profile:
        return {'success': False, 'error': '查無此帳號，請確認電話或 Email'}
    if profile.line_user_id and profile.line_user_id != line_user_id:
        return {'success': False, 'error': '此帳號已綁定其他 LINE 帳號'}

    profile.line_user_id = line_user_id
    profile.save()
    return {'success': True}


@_line_handler.add(MessageEvent, message=TextMessageContent)
def _handle_text(event):
    user_id = event.source.user_id
    text = event.message.text.strip()

    if text == '綁定':
        # 300 秒內等待使用者輸入電話或 Email
        cache.set(f'{_BIND_WAITING}{user_id}', True, 300)
        _reply(event.reply_token, '請輸入您的行動電話或 Email 以完成帳號綁定')
        return

    if cache.get(f'{_BIND_WAITING}{user_id}'):
        cache.delete(f'{_BIND_WAITING}{user_id}')
        result = _do_bind(user_id, text)
        if result['success']:
            _reply(event.reply_token, '綁定成功！您可以開始使用夢串流上傳功能。')
        else:
            _reply(event.reply_token, f'綁定失敗：{result["error"]}，請重新輸入「綁定」再試一次。')


@login_required
def dreamlist(request):
    context = {"init_folder": request.GET.get("folder", "")}
    html = TemplateResponse(request, "dreams/dreamlist.html", context)
    return HttpResponse(html.render())


@login_required
def dreamlist_v2(request):
    context = {"init_folder": request.GET.get("folder", "")}
    html = TemplateResponse(request, "dreams/dreamlist_v2.html", context)
    return HttpResponse(html.render())


@login_required
def dream_reply(request):
    dream_id = request.GET.get("dream", "")
    context = {"dream_id": dream_id}
    html = TemplateResponse(request, "dreams/dream_reply.html", context)
    return HttpResponse(html.render())


@login_required
def dream_folder(request):
    """主題管理頁面"""
    html = TemplateResponse(request, "dreams/dreamfolder.html")
    return HttpResponse(html.render())


def dream_liff(request):
    try:
        tmpl = form_template.objects.get(name='夢串流上傳表單')
        form_json = tmpl.json
    except form_template.DoesNotExist:
        form_json = {}
    context = {'form_json': json.dumps(form_json, ensure_ascii=False)}
    html = TemplateResponse(request, 'dreams/dreamliff.html', context)
    return HttpResponse(html.render())


@csrf_exempt
def line_callback(request):
    if request.method != 'POST':
        return HttpResponse(status=405)

    signature = request.headers.get('X-Line-Signature', '')
    body = request.body.decode('utf-8')

    try:
        _line_handler.handle(body, signature)
    except InvalidSignatureError:
        logger.warning('LINE callback: invalid signature')
        return HttpResponse(status=403)
    except Exception as e:
        logger.exception('LINE callback error: %s', e)
        return HttpResponse(status=500)

    return HttpResponse('OK')


