import shortuuid
import logging
import json
import time
import os
import hmac
import hashlib

from urllib.parse import unquote, quote

from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import Permission, User
from django.shortcuts import render
from django.contrib.auth.views import (
    LoginView,
    PasswordResetCompleteView,
    PasswordResetDoneView,
)
from django.contrib.auth import (
    authenticate,
    login,
    logout,
    get_user,
    update_session_auth_hash,
)
from django.contrib.messages import get_messages
from django.http import HttpResponseRedirect, HttpResponseForbidden
from django.http.response import JsonResponse
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.dispatch import receiver
from django.views import View
from django.conf import settings
from django.views.generic.edit import FormView

from google.api_core.exceptions import GoogleAPICallError
from  google.cloud import recaptchaenterprise_v1

from commons.models import menugroup, parameter
from commons.tools import SendEmail
from .signals import reset_password_email
from .mixins import AnonymousRequiredMixin
from .models import userstatus, userprofile, PasswordResetToken, groupinfo
from .forms import LoginForm, OTPLoginForm, PasswordResetForm, PasswordResetConfirmForm, SignupForm
from .mixins import AnonymousRequiredMixin
from . import app_settings

logger = logging.getLogger("django")


class CustomSignupView(AnonymousRequiredMixin, FormView):
    """註冊會員"""

    form_class = SignupForm
    template_name = "accounts/signup.html"
    success_url = reverse_lazy("accounts:signup_success")

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        # 驗證 token 是否有效
        token = self.request.GET.get('token')
        if not token:
            return render(self.request, "accounts/signup_error.html", {"message": "不正確的註冊連結"})

        try:
            group_info = groupinfo.objects.get(is_join=True, token=token)
            self.group_info = group_info
        except groupinfo.DoesNotExist:
            return render(self.request, "accounts/signup_error.html", {"message": "不正確的註冊連結"})

        return super().dispatch(*args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['token'] = self.request.GET.get('token')
        return context

    def form_valid(self, form):
        from django.contrib.auth.hashers import make_password
        from django.utils.crypto import get_random_string
        from commons.tools import SendEmail

        try:
            # 產生隨機密碼
            raw_password = get_random_string(
                length=8,
                allowed_chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            )

            # 產生 hash username（使用 email）
            email = form.cleaned_data['email']
            hashed_username = hashlib.sha256(email.encode('utf-8')).hexdigest()[:30]

            # 建立使用者
            user = User.objects.create(
                username=hashed_username,
                first_name=form.cleaned_data['first_name'],
                email=email,
                password=make_password(raw_password),
                is_active=False
            )

            # 建立 userstatus
            userstatus.objects.create(
                user=user,
                password1=user.password,
            )

            # 根據性別隨機選擇頭像
            import random
            dir_path = 'images/avatars/'
            avatar_dir = os.path.join(settings.BASE_DIR, 'static', dir_path)
            files = [f for f in os.listdir(avatar_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
            random_avatar = random.choice(files)

            # 建立 userprofile
            userprofile.objects.create(
                user=user,
                role_id=int(form.cleaned_data['role_id']),
                org=form.cleaned_data['org'],
                avatar=f"{dir_path}{random_avatar}",
            )

            # 設定群組
            user.groups.set([self.group_info.group.id])

            # 產生密碼設定 token
            sHost = str(self.request.META['HTTP_HOST'])
            if '127.0.0.1' in sHost or 'localhost' in sHost:
                domain_name = 'http://127.0.0.1:8000'
            else:
                domain_name = self.request.scheme + "://" + sHost

            safe_token = generate_password_reset_token(user)
            pwdreset_url = f"{domain_name}/accounts/password_first_time_set_confirm/?token={safe_token}"

            # 寄送帳號開通密碼設定信
            context = {
                "user_email": user.email,
                "user": user.first_name,
                "pwdreset_url": pwdreset_url,
            }
            SendEmail("user_create").send(**context)

            return super().form_valid(form)

        except Exception as e:
            logger.error(f"註冊失敗: {e}")
            form.add_error(None, f"註冊失敗: {str(e)}")
            return self.form_invalid(form)


class CustomLoginView(LoginView):
    """登入"""

    form_class = LoginForm
    template_name = "accounts/login.html"

    def form_valid(self, form):
        """登入驗證"""
        try:
            # --- reCAPTCHA Verification ---
            expected_recaptcha_action = (
                "login"  # MUST match the action in your frontend JavaScript
            )
            assessment = self.create_assessment(expected_recaptcha_action)

            #if not self.is_recaptcha_valid(assessment, expected_recaptcha_action):
            if False:  # 暫時停用 reCAPTCHA 
                # reCAPTCHA failed - add error and redisplay form
                logger.warning(
                    f"reCAPTCHA verification failed for user attempt: {form.cleaned_data.get('login')}"
                )
                form.add_error(
                    None, "無效的 reCAPTCHA 驗證，請重試。"
                )  # Add non-field error
                # Optionally add a message: messages.error(self.request, "Invalid reCAPTCHA. Please try again.")
                return self.form_invalid(form)

            # --- reCAPTCHA Passed - Proceed with Login ---
            logger.info(
                f"reCAPTCHA verification succeeded for user attempt: {form.cleaned_data.get('login')}"
            )

            user = form.cleaned_data["user"]

            # session 暫存（如果otp可使用到）
            self.request.session["user_name"] = user.get_username()
            self.request.session["user_email"] = user.email
            self.request.session["user_role_id"] = user.userprofile.role_id
            self.request.session["is_superuser"] = user.is_superuser

            profile = userprofile.objects.filter(user=user).first()

            # === 使用 Email OTP ===
            if profile and profile.is_otp:
                otp_code = generate_email_otp(user.email)

                # OTP 專用 session
                self.request.session["otp_user_id"] = user.id
                self.request.session["otp_attempts"] = 0
                self.request.session["otp_created_at"] = int(time.time())

                # 寄送 Email OTP
                context = {
                    "user": user.first_name or user.username,
                    "user_email": user.email,
                    "otp_code": otp_code,
                    "expire_minutes": 5,
                }
                SendEmail("otp_login").send(**context)

                return HttpResponseRedirect(reverse_lazy("accounts:otp_login"))

            # === 一般登入（未啟用 OTP） ===
            login(self.request, user)
            return HttpResponseRedirect(self.get_success_url())
        except Exception as e:
            logger.error(e)
            return HttpResponseRedirect(reverse_lazy("accounts:login"))

    def create_assessment(
        self, recaptcha_action: str
    ) -> recaptchaenterprise_v1.Assessment | None:
        """Creates an assessment to verify the reCAPTCHA token."""
        recaptcha_response_token = self.request.POST.get("g-recaptcha-response")
        if not recaptcha_response_token:
            logger.warning("reCAPTCHA token not found in POST data.")
            return None

        try:
            if settings.DEBUG:
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = (
                    "smart-spark-382102-3218296800ed.json"
                )

            client = recaptchaenterprise_v1.RecaptchaEnterpriseServiceClient()
            project_id = settings.GOOGLE_RECAPTCHA_ENTERPRISE_PROJECT_ID
            site_key = settings.GOOGLE_RECAPTCHA_ENTERPRISE_SITE_KEY

            # Build the assessment request.
            assessment = recaptchaenterprise_v1.Assessment()
            assessment.event.token = recaptcha_response_token
            assessment.event.site_key = site_key
            # assessment.event.expected_action = recaptcha_action # Add this if you want strict action matching

            project_name = f"projects/{project_id}"

            request = recaptchaenterprise_v1.CreateAssessmentRequest(
                parent=project_name,
                assessment=assessment,
            )

            response = client.create_assessment(request=request)
            logger.info(
                f"reCAPTCHA assessment response received. Name: {response.name}"
            )
            return response

        except GoogleAPICallError as e:
            logger.error(f"Could not create reCAPTCHA assessment: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(
                f"An unexpected error occurred during reCAPTCHA assessment: {e}",
                exc_info=True,
            )
            return None

    def is_recaptcha_valid(
        self, assessment: recaptchaenterprise_v1.Assessment, expected_action: str
    ) -> bool:
        """Checks if the assessment is valid based on score and action."""
        if not assessment:
            return False

        # Check if the token is valid.
        if not assessment.token_properties.valid:
            logger.warning(
                f"reCAPTCHA token invalid: {assessment.token_properties.invalid_reason.name}"
            )
            return False

        # Check if the expected action matches. IMPORTANT: Match the action string from your JS ('login').
        # If you didn't set assessment.event.expected_action above, this check might be less strict
        # depending on your Google Cloud console settings. It's better to check explicitly.
        if assessment.token_properties.action != expected_action:
            logger.warning(
                f"reCAPTCHA action mismatch: Expected '{expected_action}', "
                f"Got '{assessment.token_properties.action}'"
            )
            # Decide if this is a hard failure or just a warning based on your policy
            return False  # Treat action mismatch as failure for security

        # Check the score (0.0 = high risk, 1.0 = low risk).
        score = assessment.risk_analysis.score
        required_score = getattr(
            settings, "RECAPTCHA_REQUIRED_SCORE", 0.5
        )  # Default to 0.5 if not set
        logger.info(f"reCAPTCHA score: {score} (Threshold: {required_score})")
        if score < required_score:
            logger.warning(f"reCAPTCHA score {score} below threshold {required_score}.")
            return False

        # All checks passed
        return True


class NormalLogoutView(View):
    """登出"""

    def get(self, request, *args, **kwargs):
        success_url = app_settings.LOGOUT_REDIRECT_URL
        #  將session中使用者資訊清空
        self.request.session.flush()
        logout(request)
        return HttpResponseRedirect(success_url)


class ChangePasswordView(View):
    """變更密碼"""

    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)
        old_password = data.get("old_password")
        new_password = data.get("new_password")
        re_new_password = data.get("re_new_password")

        is_clean, error = self._clean(
            request, old_password, new_password, re_new_password
        )
        if is_clean:
            user = get_user(request)
            user.set_password(new_password)
            update_session_auth_hash(request, user)
            user.save()
            # 變更密碼時要記錄前三次密碼
            if user:
                qsUserStatus = userstatus.objects.filter(user=user).first()
                qsUserStatus.password3 = qsUserStatus.password2
                qsUserStatus.password2 = qsUserStatus.password1
                qsUserStatus.password1 = user.password
                qsUserStatus.save()

            return JsonResponse({"message": "success"})
        else:
            return JsonResponse({"message": error})

    def _clean(self, request, old_password, new_password, re_new_password):
        error = ""
        user = get_user(request)

        if user.check_password(old_password) is False:
            error = "舊密碼輸入錯誤"
            return False, error

        if old_password == new_password:
            error = "新的密碼不能跟舊的密碼一樣"
            return False, error

        if new_password != re_new_password:
            error = "二次新密碼不一致"
            return False, error

        # 驗證新密碼與資料庫歷史紀錄前三次是否相同
        qsUserStatus = userstatus.objects.filter(user=user).first()
        sUt_password1 = qsUserStatus.password1
        sUt_password2 = qsUserStatus.password2
        sUt_password3 = qsUserStatus.password3
        bUt_check_password1 = bUt_check_password2 = bUt_check_password3 = False
        if sUt_password1 is not None:
            bUt_check_password1 = check_password(new_password, sUt_password1)
        if sUt_password2 is not None:
            bUt_check_password2 = check_password(new_password, sUt_password2)
        if sUt_password3 is not None:
            bUt_check_password3 = check_password(new_password, sUt_password3)
        if bUt_check_password3 or bUt_check_password2 or bUt_check_password1:
            error = "密碼與前三次歷史紀錄重複"
            return False, error
        return True, error


class CustomPasswordResetView(FormView):
    """
    忘記密碼step1:輸入email後檢查是否存在此mail，若有則寄送密碼重設信件
    """

    form_class = PasswordResetForm
    template_name = "accounts/password_reset.html"
    success_url = reverse_lazy("accounts:password_reset_done")

    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def form_valid(self, form):
        # 密碼重設信件URL
        sHost = str(self.request.META["HTTP_HOST"])
        if "127.0.0.1" in sHost or "locahost" in sHost:
            domain_name = "http://127.0.0.1:8000"
        else:
            domain_name = "https://" + sHost

        form.save(domain_name)
        if form.errors:
            return render(self.request, self.template_name, context={"form": form})

        return super().form_valid(form)

    @receiver(reset_password_email)
    def reset_password_email_signal_handler(sender, user, email, domain_name, **kwargs):
        """以signal方式通報"""
        logger.debug("reset_password_email received")

        safe_token = generate_password_reset_token(user)
        pwdreset_url = (
            f"{domain_name}/accounts/password_reset_confirm/?token={safe_token}"
        )

        # 電子郵件內容樣板
        context = {
            "user": user.first_name,
            "user_email": email,
            "pwdreset_url": pwdreset_url,
            "email_expire_min": app_settings.PASSWORD_RESET_EMAIL_EXPIRE_MIN,
        }
        SendEmail("password_reset").send(**context)  # 寄送註冊信


class CustomPasswordResetDoneView(PasswordResetDoneView):
    """
    忘記密碼step2:顯示密碼重設信件已發送
    """

    template_name = "accounts/password_reset_done.html"


class CustomPasswordResetConfirmView(AnonymousRequiredMixin, FormView):
    """忘記密碼step3:重設密碼驗證信件確認成功後要變更密碼View"""

    form_class = PasswordResetConfirmForm
    template_name = "accounts/password_reset_confirm.html"
    success_url = reverse_lazy("accounts:password_reset_complete")
    login = ""

    @method_decorator(csrf_protect)
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return render(self.request, "accounts/please_logout_first.html")

        token = self.request.GET.get("token")
        if not token:
            return HttpResponseForbidden("缺少 token")

        try:
            raw_token = unquote(token)  # 還原 URL encode
            prt = PasswordResetToken.objects.get(token=raw_token)
            if prt.is_expired():
                prt.delete()  # 過期就刪掉
                message = "重設密碼連結已經失效，請重新申請"
                context = {
                    "message": message,
                }
                return render(
                    self.request, "accounts/password_reset_expired.html", context
                )

            self.login = prt.user.email

        except PasswordResetToken.DoesNotExist:
            # 過期處理
            message = "重設密碼連結已經失效，請重新申請"
            context = {
                "message": message,
            }
            return render(self.request, "accounts/password_reset_expired.html", context)
        except Exception as e:
            logger.error(e)
            raise

        # self.login = kwargs['param']
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, *args, **kwargs):
        context = super(FormView, self).get_context_data()
        context.update(
            {
                "login": self.login,
            }
        )
        return context

    def form_valid(self, form):
        form.save()
        if form.errors:
            return render(self.request, self.template_name, context={"form": form})

        return super().form_valid(form)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["initial"]["login"] = self.login
        return kwargs


class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    """
    忘記密碼step4:重設密碼成功，5秒後導入登入頁面
    """

    template_name = "accounts/password_reset_success.html"


class FirstTimePasswordSetConfirmView(AnonymousRequiredMixin, FormView):
    """帳號創立時初次設定密碼View"""

    form_class = PasswordResetConfirmForm
    template_name = "accounts/password_first_time_set_confirm.html"
    success_url = reverse_lazy("accounts:password_reset_complete")
    login = ""

    @method_decorator(csrf_protect)
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return render(self.request, "accounts/please_logout_first.html")

        token = self.request.GET.get("token")
        if not token:
            return HttpResponseForbidden("缺少 token")

        try:
            raw_token = unquote(token)  # 還原 URL encode
            prt = PasswordResetToken.objects.get(token=raw_token)
            # 防止重複使用
            if User.objects.filter(email=prt.user.email, is_active=True).exists():
                prt.delete()  # 重複使用就刪掉
                message = "重設密碼連結已經失效，請重新申請"
                context = {
                    "message": message,
                }
                return render(
                    self.request, "accounts/login.html", context
                )

            self.login = prt.user.email

        except PasswordResetToken.DoesNotExist:
            # 過期處理
            message = "重設密碼連結已經失效，請重新申請"
            context = {
                "message": message,
            }
            return render(self.request, "accounts/login.html", context)
        except Exception as e:
            logger.error(e)
            raise

        # self.login = kwargs['param']
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, *args, **kwargs):
        context = super(FormView, self).get_context_data()
        context.update(
            {
                "login": self.login,
            }
        )
        return context

    def form_valid(self, form):
        user = form.save()
        # 啟用帳號
        user.is_active = True
        user.save()
        if form.errors:
            return render(self.request, self.template_name, context={"form": form})

        return super().form_valid(form)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["initial"]["login"] = self.login
        return kwargs


class OTPLoginView(FormView):
    """雙因素認證"""

    template_name = "accounts/otplogin.html"
    form_class = OTPLoginForm
    success_url = reverse_lazy("index")

    OTP_EXPIRE_SECONDS = 300  # 5 分鐘
    MAX_ATTEMPTS = 5

    def form_valid(self, form):
        try:
            session = self.request.session

            user_id = session.get("otp_user_id")
            created_at = session.get("otp_created_at")
            attempts = session.get("otp_attempts", 0)

            # 過期
            if time.time() - created_at > self.OTP_EXPIRE_SECONDS:
                self._clear_otp_session()
                form.add_error(None, "認證碼已過期，請重新登入")
                return self.form_invalid(form)

            # 嘗試次數限制
            if attempts >= self.MAX_ATTEMPTS:
                self._clear_otp_session()
                form.add_error(None, "認證碼錯誤次數過多，請重新登入")
                return self.form_invalid(form)

            user = User.objects.get(id=user_id)
            otp_code = str(form.cleaned_data.get("otpcode"))

            # 驗證otp
            if not self._verify_otp(user.email, otp_code):
                session["otp_attempts"] = attempts + 1
                form.add_error("otpcode", "認證碼錯誤")
                return self.form_invalid(form)

            # otp 認證成功登入
            login(self.request, user, backend="accounts.backend.CustomAuthBackend")
            del self.request.session["otp_user_id"]  # 移除session

            return HttpResponseRedirect(self.get_success_url())
        except Exception as e:
            logger.error(e)
            return HttpResponseRedirect(reverse_lazy("accounts:otp_login"))

    def _verify_otp(
        self, email: str, otp_code: str, *, window: int = 1, OTP_STEP_SECONDS: int = 300
    ) -> bool:
        """
        驗證 Email OTP
        window = 允許前後幾個 time step（防止剛好跨秒）
        """
        now = int(time.time())

        for w in range(-window, window + 1):
            candidate_time = now + (w * OTP_STEP_SECONDS)
            if generate_email_otp(email, candidate_time) == otp_code:
                return True

        return False

    def _clear_otp_session(self):
        for key in ["otp_user_id", "otp_attempts", "otp_created_at"]:
            self.request.session.pop(key, None)


@login_required
def userlist(request):
    from django.contrib.auth.models import Group

    qsSex = parameter.objects.filter(pa_type='性別')
    qsGroups = Group.objects.all().order_by('name')

    context = {
        "qsSex": qsSex,
        "Groups": qsGroups,
    }

    return render(request, "accounts/userlist.html", context)


@login_required
def notification_list(request):
    return render(request, "accounts/notificationlist.html")


@login_required
def auth_group_list(request):
    """ 群組人員權限管理 """
    from dreams.models import dream
    from django.db.models import Q

    qsFolders = dream.objects.filter(is_folder=True, folder_enable=True).order_by('title')
    # 只顯示沒有加入任何群組的使用者（排除 superuser 和 AnonymousUser）
    qaUser = User.objects.exclude(
        Q(is_superuser=True) | Q(username='AnonymousUser')
    ).filter(groups__isnull=True).order_by('first_name')

    context = {
        "Folders": qsFolders,
        "Users": qaUser,
    }

    return render(request, 'accounts/auth_group_list.html', context)


@login_required
def auth_groupobject_list(request):
    """ 群組指標權限管理 """
    qaUser = User.objects.filter()
    objParameter = parameter.objects.filter(pa_key='指標分類').order_by('pa_sort')

    context = {
        "Users": qaUser,
        "objParameter": objParameter,
    }

    return render(request, 'accounts/auth_groupobject_list.html', context)


def generate_password_reset_token(user):
    """產生重設密碼的驗證碼"""
    token = shortuuid.random(length=8)  # 生成 8 字元 token
    PasswordResetToken.objects.create(user=user, token=token)
    return token


def generate_email_otp(email: str, at_time: int | None = None) -> str:
    """產生 Email OTP 驗證碼"""
    OTP_LENGTH = 6
    OTP_STEP_SECONDS = 300  # 5 分鐘

    if at_time is None:
        at_time = int(time.time())

    key = email.encode("utf-8")
    timestep = at_time // OTP_STEP_SECONDS

    hmac_object = hmac.new(key, timestep.to_bytes(8, "big"), hashlib.sha1)
    hmac_sha1 = hmac_object.hexdigest()

    offset = int(hmac_sha1[-1], 16)
    binary = int(hmac_sha1[offset * 2 : (offset * 2) + 8], 16) & 0x7FFFFFFF
    print(str(binary)[-OTP_LENGTH:])

    return str(binary)[-OTP_LENGTH:]

