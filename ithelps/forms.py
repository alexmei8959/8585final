from django import forms
from .models import Ithelp

class RepairForm(forms.ModelForm):
    # 先定義一個基本的 FileField
    image = forms.FileField(
        label="上傳圖片/影片 (可多選)", 
        required=False, 
        widget=forms.FileInput(attrs={'class': 'form-control'})
    )

    def __init__(self, *args, **kwargs):
        super(RepairForm, self).__init__(*args, **kwargs)
        # 手動將 multiple 屬性注入到 image 欄位中
        # 這可以繞過 Django 初始化時的嚴格檢查
        self.fields['image'].widget.attrs.update({'multiple': True})

        # ⭐ 加入這行：讓 status 欄位在表單驗證時不是必填
        if 'status' in self.fields:
            self.fields['status'].required = False
            
    class Meta:
        model = Ithelp
        fields = ['username', 'location', 'description', 'status', 'handler_name', 'resolution_notes']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '您的姓名'}),
            'location': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '報修地點,ex 宣教四樓 山莊探索教室...'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': '請描述故障狀況'}),
            # 處理狀態：下拉選單
            'status': forms.Select(attrs={'class': 'form-select'}),
            
            # 處理人：單行輸入
            'handler_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '請輸入處理者'}),
            
            # 維修過程：多行輸入
            'resolution_notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': '請填寫維修紀錄'}),
        }

        labels = {
            'username': '姓名',
            'location': '地點',
            'description': '故障描述',
        }