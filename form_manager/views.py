from django.shortcuts import render

# Create your views here.


def form_template_view(request):
    return render(request, "form_manager/form_template.html")
