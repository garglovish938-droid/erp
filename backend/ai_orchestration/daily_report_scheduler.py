import os
import datetime
import logging
from sqlalchemy.orm import Session

import models
from config import settings
from ai_orchestration.gemini_client import query_gemini_with_context
from ai_orchestration.local_reasoning_client import query_local_reasoning
from ai_orchestration.automation_coordinator import trigger_owner_reporting_webhook
from ai_orchestration.pdf_generator import generate_pdf_report
from ai_orchestration.email_client import send_smtp_email

logger = logging.getLogger("nexora_report_scheduler")

def generate_daily_report(db: Session) -> dict:
    """
    Collects ERP statistics, queries reasoning engines for analysis,
    triggers alerts, and archives report details.
    """
    logger.info("Initializing daily 8 AM owner report compile trigger.")
    
    # 1. Gather stats from relational ledger tables
    try:
        inventory_items = db.query(models.InventoryItem).filter(models.InventoryItem.is_deleted == False).all()
        low_stock_count = sum(1 for item in inventory_items if item.quantity <= item.minimum_stock_level)
        total_valuation = sum(item.quantity * item.unit_cost for item in inventory_items)
        
        active_projects = db.query(models.Project).filter(
            models.Project.is_deleted == False,
            models.Project.status == "active"
        ).count()
        
        # Cash Book dynamic balance calculation
        cashbook_entries = db.query(models.CashBook).filter(models.CashBook.is_deleted == False).all()
        capital_bal = 0.0
        for entry in cashbook_entries:
            if entry.transaction_type == "add":
                capital_bal += entry.amount
            elif entry.transaction_type == "deduct":
                capital_bal -= entry.amount
                
        # Wallets total balance
        wallets = db.query(models.FactoryWallet).filter(models.FactoryWallet.is_deleted == False).all()
        wallets_bal = sum(w.balance for w in wallets)
        
        # Daily Expenses total
        today = datetime.date.today()
        expenses = db.query(models.DailyExpense).filter(
            models.DailyExpense.is_deleted == False,
            models.DailyExpense.expense_date == today
        ).all()
        expenses_total = sum(e.amount for e in expenses)
        
        # Attendance total
        attendance_count = db.query(models.Attendance).filter(
            models.Attendance.date == today
        ).count()
        
    except Exception as e:
        logger.error(f"Error gathering stats for daily report: {e}")
        return {"status": "error", "message": f"Data gather failed: {str(e)}"}

    # 2. Formulate context details
    context_data = (
        f"--- Nexora AI Factory KPI Data ({today.isoformat()}) ---\n"
        f"• Active Projects Pipeline: {active_projects}\n"
        f"• Total Inventory Valuation: INR {total_valuation:,.2f} ({low_stock_count} Low Stock Warnings)\n"
        f"• Dynamic Company Ledger balance: INR {capital_bal:,.2f}\n"
        f"• Active Wallets cash: INR {wallets_bal:,.2f}\n"
        f"• Today's Expense burn: INR {expenses_total:,.2f}\n"
        f"• Today's Staff checked-in: {attendance_count} present\n"
    )

    # 3. Call Advanced reasoning client (with local client fallback)
    analysis = None
    prompt = "Create an Executive Summary KPI analysis, identifying low stock risks or project delays, and provide recommendations."
    
    if settings.GEMINI_API_KEY:
        analysis = query_gemini_with_context(prompt, context_data)
        
    if not analysis and settings.OLLAMA_URL:
        analysis = query_local_reasoning(prompt, context_data)
        
    if not analysis:
        analysis = "Local Fallback: All systems operational. Review inventory levels for low stock warnings."

    report_content = f"{context_data}\n--- EXECUTIVE ANALYSIS ---\n{analysis}"

    # 4. Save to files & Generate PDF
    archive_dir = settings.BACKUP_DIR
    os.makedirs(archive_dir, exist_ok=True)
    report_file_path = os.path.join(archive_dir, f"daily_kpi_report_{today.strftime('%Y%m%d')}.txt")
    pdf_file_path = os.path.join(archive_dir, f"daily_kpi_report_{today.strftime('%Y%m%d')}.pdf")
    
    # Save TXT
    try:
        with open(report_file_path, "w", encoding="utf-8") as f:
            f.write(report_content)
        logger.info(f"Daily report successfully archived to {report_file_path}")
    except Exception as e:
        logger.error(f"Failed to archive daily report: {e}")

    # Generate ReportLab PDF
    sections = [
        {
            "header": f"Operational Metrics Summary ({today.isoformat()})",
            "table_data": [
                ["KPI Metric Description", "Reported Value"],
                ["Active Projects Pipeline", f"{active_projects}"],
                ["Total Inventory Valuation", f"INR {total_valuation:,.2f}"],
                ["Low Stock Warnings", f"{low_stock_count}"],
                ["Dynamic Ledger Capital Balance", f"INR {capital_bal:,.2f}"],
                ["Active Wallets Cash Balance", f"INR {wallets_bal:,.2f}"],
                ["Today's Expense Burn", f"INR {expenses_total:,.2f}"],
                ["Today's Staff Headcount Present", f"{attendance_count}"]
            ]
        },
        {
            "header": "Executive Intelligence Analysis",
            "content": analysis
        }
    ]
    generate_pdf_report(pdf_file_path, f"Nexora AI Daily KPI Executive Report", sections)

    # 5. Email Owner via SMTP Mailer
    owner_email = settings.SMTP_FROM or "owner@allureliving.com"
    send_smtp_email(
        to_email=owner_email,
        subject=f"Nexora AI: Daily KPI Executive Report - {today.isoformat()}",
        text_body=f"Dear Owner,\n\nPlease find attached the daily KPI executive report generated by Nexora AI for {today.isoformat()}.\n\n{context_data}\n\nBest regards,\nNexora AI Operations Coordinator",
        attachment_path=pdf_file_path
    )

    # 6. Trigger Automation coordinator webhooks
    n8n_status = trigger_owner_reporting_webhook(
        report_type="daily_kpi_summary",
        report_data={
            "date": today.isoformat(),
            "active_projects": active_projects,
            "total_valuation": total_valuation,
            "low_stock_count": low_stock_count,
            "capital_balance": capital_bal,
            "wallets_balance": wallets_bal,
            "today_expense": expenses_total,
            "today_attendance": attendance_count,
            "executive_summary": analysis,
            "report_path": report_file_path,
            "pdf_path": pdf_file_path
        }
    )

    return {
        "status": "success",
        "date": today.isoformat(),
        "report_archived": report_file_path,
        "automation_trigger": n8n_status,
        "summary": analysis
    }

def generate_weekly_report(db: Session) -> dict:
    """
    Collects weekly statistics (last 7 days), queries Gemini reasoning for weekly review,
    generates PDF, and emails the owner.
    """
    logger.info("Initializing weekly owner report compile trigger.")
    today = datetime.date.today()
    last_week = today - datetime.timedelta(days=7)
    
    try:
        # Gather weekly statistics
        expenses_weekly = db.query(models.DailyExpense).filter(
            models.DailyExpense.is_deleted == False,
            models.DailyExpense.expense_date >= last_week,
            models.DailyExpense.expense_date <= today
        ).all()
        expenses_total = sum(e.amount for e in expenses_weekly)
        
        attendance_weekly = db.query(models.Attendance).filter(
            models.Attendance.date >= last_week,
            models.Attendance.date <= today
        ).count()
        
        inventory_items = db.query(models.InventoryItem).filter(models.InventoryItem.is_deleted == False).all()
        low_stock_count = sum(1 for item in inventory_items if item.quantity <= item.minimum_stock_level)
        total_valuation = sum(item.quantity * item.unit_cost for item in inventory_items)
        
        active_projects = db.query(models.Project).filter(
            models.Project.is_deleted == False,
            models.Project.status == "active"
        ).count()
        
    except Exception as e:
        logger.error(f"Error gathering stats for weekly report: {e}")
        return {"status": "error", "message": f"Data gather failed: {str(e)}"}
        
    context_data = (
        f"--- Allure Living Weekly Executive KPI Summary ({last_week.isoformat()} to {today.isoformat()}) ---\n"
        f"• Active Projects Pipeline: {active_projects}\n"
        f"• Current Inventory Valuation: INR {total_valuation:,.2f} ({low_stock_count} Low Stock Warnings)\n"
        f"• Weekly Total Operating Expenses: INR {expenses_total:,.2f}\n"
        f"• Cumulative Weekly Staff Attendance (Check-ins): {attendance_weekly}\n"
    )
    
    analysis = None
    prompt = "Create a Weekly Executive Performance Summary. Compare costs against operations, identify stock bottlenecks, and suggest next week's adjustments."
    
    if settings.GEMINI_API_KEY:
        analysis = query_gemini_with_context(prompt, context_data)
    if not analysis and settings.OLLAMA_URL:
        analysis = query_local_reasoning(prompt, context_data)
    if not analysis:
        analysis = "Weekly operational metrics are within standard ranges. Safety stock verification recommended."
        
    report_content = f"{context_data}\n--- WEEKLY EXECUTIVE ANALYSIS ---\n{analysis}"
    
    # Save files
    archive_dir = settings.BACKUP_DIR
    os.makedirs(archive_dir, exist_ok=True)
    report_file_path = os.path.join(archive_dir, f"weekly_kpi_report_{today.strftime('%Y%W')}.txt")
    pdf_file_path = os.path.join(archive_dir, f"weekly_kpi_report_{today.strftime('%Y%W')}.pdf")
    
    try:
        with open(report_file_path, "w", encoding="utf-8") as f:
            f.write(report_content)
    except Exception as e:
        logger.error(f"Failed to archive weekly report text: {e}")
        
    sections = [
        {
            "header": f"Weekly Performance Indicators ({last_week.isoformat()} to {today.isoformat()})",
            "table_data": [
                ["KPI Metric Description", "Reported Value"],
                ["Active Projects Pipeline", f"{active_projects}"],
                ["Current Inventory Valuation", f"INR {total_valuation:,.2f}"],
                ["Low Stock Warnings Count", f"{low_stock_count}"],
                ["Weekly Expenses Cumulative Burn", f"INR {expenses_total:,.2f}"],
                ["Weekly Attendance Check-ins", f"{attendance_weekly}"]
            ]
        },
        {
            "header": "Weekly Operational & Strategic Recommendations",
            "content": analysis
        }
    ]
    generate_pdf_report(pdf_file_path, f"Allure Living Weekly Executive Report", sections)
    
    owner_email = settings.SMTP_FROM or "owner@allureliving.com"
    send_smtp_email(
        to_email=owner_email,
        subject=f"Nexora AI: Weekly KPI Executive Report - Week {today.strftime('%W, %Y')}",
        text_body=f"Dear Owner,\n\nPlease find attached the weekly KPI executive report generated by Nexora AI.\n\n{context_data}\n\nBest regards,\nNexora AI Operations Coordinator",
        attachment_path=pdf_file_path
    )
    
    return {
        "status": "success",
        "date": today.isoformat(),
        "report_archived": report_file_path,
        "summary": analysis
    }

def generate_monthly_report(db: Session) -> dict:
    """
    Collects monthly statistics (last 30 days), queries Gemini reasoning for monthly review,
    generates PDF, and emails the owner.
    """
    logger.info("Initializing monthly owner report compile trigger.")
    today = datetime.date.today()
    last_month = today - datetime.timedelta(days=30)
    
    try:
        # Gather monthly statistics
        expenses_monthly = db.query(models.DailyExpense).filter(
            models.DailyExpense.is_deleted == False,
            models.DailyExpense.expense_date >= last_month,
            models.DailyExpense.expense_date <= today
        ).all()
        expenses_total = sum(e.amount for e in expenses_monthly)
        
        attendance_monthly = db.query(models.Attendance).filter(
            models.Attendance.date >= last_month,
            models.Attendance.date <= today
        ).count()
        
        inventory_items = db.query(models.InventoryItem).filter(models.InventoryItem.is_deleted == False).all()
        low_stock_count = sum(1 for item in inventory_items if item.quantity <= item.minimum_stock_level)
        total_valuation = sum(item.quantity * item.unit_cost for item in inventory_items)
        
        active_projects = db.query(models.Project).filter(
            models.Project.is_deleted == False,
            models.Project.status == "active"
        ).count()
        
    except Exception as e:
        logger.error(f"Error gathering stats for monthly report: {e}")
        return {"status": "error", "message": f"Data gather failed: {str(e)}"}
        
    context_data = (
        f"--- Allure Living Monthly Executive KPI Summary ({last_month.isoformat()} to {today.isoformat()}) ---\n"
        f"• Active Projects Pipeline: {active_projects}\n"
        f"• Current Inventory Valuation: INR {total_valuation:,.2f} ({low_stock_count} Low Stock Warnings)\n"
        f"• Monthly Total Operating Expenses: INR {expenses_total:,.2f}\n"
        f"• Cumulative Monthly Staff Attendance (Check-ins): {attendance_monthly}\n"
    )
    
    analysis = None
    prompt = "Create a Monthly Executive Performance Summary. Compare costs against operations, identify stock bottlenecks, and suggest next month's adjustments."
    
    if settings.GEMINI_API_KEY:
        analysis = query_gemini_with_context(prompt, context_data)
    if not analysis and settings.OLLAMA_URL:
        analysis = query_local_reasoning(prompt, context_data)
    if not analysis:
        analysis = "Monthly operational metrics are within standard ranges. Safety stock verification recommended."
        
    report_content = f"{context_data}\n--- MONTHLY EXECUTIVE ANALYSIS ---\n{analysis}"
    
    # Save files
    archive_dir = settings.BACKUP_DIR
    os.makedirs(archive_dir, exist_ok=True)
    report_file_path = os.path.join(archive_dir, f"monthly_kpi_report_{today.strftime('%Y%m')}.txt")
    pdf_file_path = os.path.join(archive_dir, f"monthly_kpi_report_{today.strftime('%Y%m')}.pdf")
    
    try:
        with open(report_file_path, "w", encoding="utf-8") as f:
            f.write(report_content)
    except Exception as e:
        logger.error(f"Failed to archive monthly report text: {e}")
        
    sections = [
        {
            "header": f"Monthly Performance Indicators ({last_month.isoformat()} to {today.isoformat()})",
            "table_data": [
                ["KPI Metric Description", "Reported Value"],
                ["Active Projects Pipeline", f"{active_projects}"],
                ["Current Inventory Valuation", f"INR {total_valuation:,.2f}"],
                ["Low Stock Warnings Count", f"{low_stock_count}"],
                ["Monthly Expenses Cumulative Burn", f"INR {expenses_total:,.2f}"],
                ["Monthly Attendance Check-ins", f"{attendance_monthly}"]
            ]
        },
        {
            "header": "Monthly Operational & Strategic Recommendations",
            "content": analysis
        }
    ]
    generate_pdf_report(pdf_file_path, f"Allure Living Monthly Executive Report", sections)
    
    owner_email = settings.SMTP_FROM or "owner@allureliving.com"
    send_smtp_email(
        to_email=owner_email,
        subject=f"Nexora AI: Monthly KPI Executive Report - {today.strftime('%B, %Y')}",
        text_body=f"Dear Owner,\n\nPlease find attached the monthly KPI executive report generated by Nexora AI.\n\n{context_data}\n\nBest regards,\nNexora AI Operations Coordinator",
        attachment_path=pdf_file_path
    )
    
    return {
        "status": "success",
        "date": today.isoformat(),
        "report_archived": report_file_path,
        "summary": analysis
    }
