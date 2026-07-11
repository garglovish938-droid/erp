import os
import logging
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

logger = logging.getLogger("nexora_pdf_generator")

def generate_pdf_report(output_path: str, title: str, sections: list) -> bool:
    """
    Generates a professional PDF report containing formatted paragraphs and tables using ReportLab.
    """
    try:
        # Create output directories if they don't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()
        
        # Define premium corporate typography styles
        title_style = ParagraphStyle(
            name="ReportTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=colors.HexColor("#1A365D"),  # Slate Blue
            spaceAfter=20
        )
        
        header_style = ParagraphStyle(
            name="SectionHeader",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=colors.HexColor("#2C3E50"),
            spaceBefore=12,
            spaceAfter=6,
            keepWithNext=True
        )
        
        body_style = ParagraphStyle(
            name="ReportBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#34495E"),
            spaceAfter=10
        )

        story = []
        
        # Add Title
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 10))
        
        # Build document sections
        for section in sections:
            header_text = section.get("header")
            content_text = section.get("content")
            table_data = section.get("table_data")
            
            if header_text:
                story.append(Paragraph(header_text, header_style))
                
            if content_text:
                # Support multi-line texts split by newlines
                for line in content_text.split("\n"):
                    if line.strip():
                        story.append(Paragraph(line.strip(), body_style))
                        
            if table_data:
                # Wrap each cell text in a Paragraph to ensure text wrapping inside table cells
                table_paragraphs = []
                for row in table_data:
                    row_paragraphs = []
                    for cell in row:
                        cell_str = str(cell)
                        row_paragraphs.append(Paragraph(cell_str, body_style))
                    table_paragraphs.append(row_paragraphs)
                    
                t = Table(table_paragraphs, colWidths=[2.5 * inch] * len(table_data[0]))
                
                # Apply corporate styling to the data grid table
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#ECF0F1")),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#2C3E50")),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('BOTTOMPADDING', (0,0), (-1,0), 6),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BDC3C7")),
                    ('TOPPADDING', (0,0), (-1,-1), 6),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(t)
                story.append(Spacer(1, 10))
                
        doc.build(story)
        logger.info(f"PDF successfully generated at {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to generate PDF document: {e}")
        return False
