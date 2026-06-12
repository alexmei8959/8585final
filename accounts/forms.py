from django import forms
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model, authenticate, password_validation
from .signals import reset_password_email

User = get_user_model()


class LoginForm(forms.Form):
    """Form used for user login"""

    login = forms.CharField()
    password = forms.CharField(widget=forms.PasswordInput())

    def __init__(self, request=None, *args, **kwargs):
        self.request = request
        super(LoginForm, self).__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super().clean()
        login = cleaned_data.get("login")
        password = cleaned_data.get("password")

        if login and password:
            self.user_cache = authenticate(
                self.request, login=login, password=password
            )
            if self.user_cache is None:
                raise forms.ValidationError("請輸入正確的帳號及密碼。")
            cleaned_data["user"] = self.user_cache

        return cleaned_data


class EmailValidationForm(forms.Form):
    """Form to validate email field"""

    email = forms.EmailField()


class UsernameValidationForm(forms.Form):
    """Form to validate username field"""

    username = forms.CharField()


class PasswordResetForm(forms.Form):
    """檢查提供的 email 是否存在。
    如果存在，則觸發 `reset_password_email` 訊號，並傳遞使用者與密碼重設連結。
    """

    email = forms.EmailField(label="Email", max_length=255)
    recaptcha = forms.CharField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @staticmethod
    def get_user_by_email(email):
        """根據 email 查找使用者"""
        try:
            qs = User.objects.filter(email__iexact=email)
            # qs = qs.filter(is_active=True)
            return qs.first()
        except User.DoesNotExist:
            return None

    def save(self, domain_name):
        email = self.cleaned_data.get("email")

        if email:
            user = self.get_user_by_email(email)
            if user:
                reset_password_email.send(
                    sender=self.__class__, user=user, email=email, domain_name=domain_name
                )
            else:
                self.add_error("email", "系統中無此Email!")


class OTPLoginForm(forms.Form):
    """Form used for user otp login"""

    otpcode = forms.CharField()

    def clean(self):
        # 繼承父類別的驗證
        cleaned_data = super().clean()

        # 如果你有自定義驗證邏輯，寫在這裡
        errors = {}

        if errors:
            raise ValidationError(errors)

        # 必須回傳 cleaned_data
        return cleaned_data


class SignupForm(forms.Form):
    """註冊表單"""
    first_name = forms.CharField(max_length=150, label="姓名")
    email = forms.EmailField(label="Email")
    org = forms.CharField(max_length=100, label="所屬教會")
    role_id = forms.ChoiceField(
        choices=[
            ('2', '牧長'),
            ('3', '組長'),
            ('4', '一般弟兄姊妹')
        ],
        label="身分別"
    )

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("此Email已被註冊!")
        return email

    def clean_first_name(self):
        """驗證姓名欄位"""
        first_name = self.cleaned_data.get("first_name")
        if not first_name or not first_name.strip():
            raise forms.ValidationError("姓名不能為空白!")
        return first_name.strip()


class PasswordResetConfirmForm(forms.Form):
    """ 當重設密碼驗證信驗證通過後，使用者輸入2次新密碼
        參考SetPasswordForm
    """

    error_messages = {
        "password_mismatch": _("The two password fields didn't match."),
    }
    login = forms.CharField()
    new_password1 = forms.CharField(
        required=True,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        strip=False,
        help_text=password_validation.password_validators_help_text_html(),
    )
    new_password2 = forms.CharField(
        required=True,
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def clean(self):
        errors = {}

        if errors:
            raise ValidationError(errors)

    def clean_new_password2(self):
        password1 = self.cleaned_data.get("new_password1")
        password2 = self.cleaned_data.get("new_password2")
        if password1 and password2:
            if password1 != password2:
                raise ValidationError(
                    self.error_messages["password_mismatch"],
                    code="password_mismatch",
                )
        password_validation.validate_password(password2)
        return password2

    @staticmethod
    def get_user_by_email(email):
        """根據 email查找使用者"""
        try:
            qs = User.objects.filter(email__iexact=email)
            return qs.first()
        except User.DoesNotExist:
            return None

    def save(self, commit=True):
        password = self.cleaned_data["new_password1"]
        login = self.cleaned_data["login"]
        user = self.get_user_by_email(login)

        try:
            user.set_password(password)
            # 密碼重設成功後啟用帳號
            user.is_active = True
            if commit:
                user.save()
            return user
        except Exception as e:
            print(e)
            return None
