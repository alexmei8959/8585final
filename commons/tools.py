import smtplib
from django.conf import settings
from django.template.loader import render_to_string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr
from commons.models import parameter


class SendEmail:
    """發送信件"""

    def __init__(self, mailType: str):
        """smtp初始化"""
        self.smtp = smtplib.SMTP(host=settings.EMAIL_HOST, port=settings.EMAIL_PORT)
        self.smtp.ehlo()
        self.smtp.starttls()
        if settings.EMAIL_HOST_USER:
            self.smtp.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
        self.mailtype = mailType

    def send(self, **kwargs):
        """ 根據情境發送信件 """

        match self.mailtype:
            case "password_reset":
                user_email_content = self.__createEmail(
                    subject="密碼重設 - 夢串流",
                    template_name="accounts/password_reset_email.html",
                    context=kwargs,
                )
                self.__sendEmail(user_email_content)
            case "user_create":
                subject = "【夢串流帳號開通】歡迎加入! 請立即設定密碼 ✨"
                template_name = "accounts/user_create_email.html"

                if template_name:
                    user_email_content = self.__createEmail(
                        subject=subject,
                        template_name=template_name,
                        context=kwargs,
                    )
                    self.__sendEmail(user_email_content)
            case "otp_login":
                subject = "登入驗證碼 - 夢串流"
                template_name = "accounts/otp_login_email.html"
                user_email_content = self.__createEmail(
                    subject=subject,
                    template_name=template_name,
                    context=kwargs,
                )
                self.__sendEmail(user_email_content)

    def __createEmail(self, subject: str, template_name: str, context: dict, bcc: bool = False):
        """寄信內容資訊"""
        html_content = render_to_string(template_name, context=context)
        content = MIMEMultipart()
        content["subject"] = Header(subject, "utf-8")  # 標題
        content["from"] = formataddr((settings.DEFAULT_FROM_NAME, settings.DEFAULT_FROM_EMAIL))  # 寄件人
        if bcc:
            content["Bcc"] = context.get("user_email", "")  # BCC 用於管理員通知
        else:
            content["to"] = context.get("user_email", "")  # 收件人

        content.attach(MIMEText(html_content, "html", "utf-8"))
        return content
    def __sendEmail(self, content):
        """發送郵件"""
        try:
            self.smtp.send_message(content)
        except Exception as e:
            print(f"發送郵件時出錯: {e}")
