from django.urls import path

from . import views

urlpatterns = [
    path('module3/strategy/', views.module3_strategy_view, name='module3-strategy'),
    path('module3/recalculate/', views.module3_recalculate_view, name='module3-recalculate'),
]
