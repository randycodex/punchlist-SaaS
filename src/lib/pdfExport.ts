import { jsPDF } from 'jspdf';
import { Project, checkpointHasIssue } from '@/types';

// Load logo as base64 for PDF
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/uai-logo.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Get image dimensions to maintain aspect ratio
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = base64;
  });
}

type LogoAssets = {
  base64: string | null;
  width: number;
  height: number;
};

async function loadLogoAssets(): Promise<LogoAssets> {
  const base64 = await loadLogoBase64();
  let width = 30;
  let height = 30;

  if (base64) {
    try {
      const dims = await getImageDimensions(base64);
      const maxLogoHeight = 25;
      const aspectRatio = dims.width / dims.height;
      height = maxLogoHeight;
      width = maxLogoHeight * aspectRatio;
    } catch {
      // Use defaults
    }
  }

  return { base64, width, height };
}

function addFooter(pdf: jsPDF, margin: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }
}

function addProjectPageHeader(
  pdf: jsPDF,
  projectName: string,
  logo: LogoAssets,
  coverPage: number,
  startPage: number,
  endPage: number
) {
  const margin = 15;
  const logoHeight = 5;
  const logoWidth = logo.height > 0 ? (logo.width / logo.height) * logoHeight : logoHeight;
  const logoY = 6;
  const textY = 10.5;

  for (let page = startPage; page <= endPage; page++) {
    if (page === coverPage) continue;
    pdf.setPage(page);
    let textX = margin;

    if (logo.base64) {
      try {
        pdf.addImage(logo.base64, 'PNG', margin, logoY, logoWidth, logoHeight);
        textX = margin + logoWidth + 3;
      } catch {
        textX = margin;
      }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(55, 65, 81);
    pdf.text(projectName, textX, textY);
    pdf.setTextColor(0, 0, 0);
  }
}

function renderProjectToPdf(pdf: jsPDF, project: Project, logo: LogoAssets) {
  const coverPage = pdf.getNumberOfPages();
  const startPage = coverPage;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentTopMargin = 21;
  const contentWidth = pageWidth - margin * 2;
  const statusIconRadius = 1.6;
  const photoGap = 4;
  const photosPerRow = 3;
  const photoWidth = (contentWidth - photoGap * (photosPerRow - 1)) / photosPerRow;
  const photoHeight = photoWidth;

  function isGeneralNotesLocation(location: { name: string; items: { name: string; checkpoints: { name: string }[] }[] }) {
    const locationName = location.name.trim().toLowerCase();
    if (locationName !== 'other') return false;
    if (location.items.length !== 1) return false;
    const item = location.items[0];
    if (item.name.trim().toLowerCase() !== 'general notes') return false;
    return item.checkpoints.length === 1 && item.checkpoints[0].name.trim().toLowerCase() === 'notes';
  }

  function drawStatusIcon(status: 'pending' | 'ok' | 'needsReview', x: number, y: number) {
    const centerY = y - 1.5;
    pdf.setLineWidth(0.35);

    if (status === 'ok') {
      pdf.setDrawColor(34, 197, 94);
      pdf.setFillColor(34, 197, 94);
      pdf.circle(x, centerY, statusIconRadius, 'F');
    } else if (status === 'needsReview') {
      pdf.setDrawColor(239, 68, 68);
      pdf.setFillColor(239, 68, 68);
      pdf.circle(x, centerY, statusIconRadius, 'F');
    } else {
      pdf.setDrawColor(156, 163, 175);
      pdf.circle(x, centerY, statusIconRadius, 'S');
    }

    pdf.setDrawColor(0, 0, 0);
    pdf.setFillColor(0, 0, 0);
  }

  function drawAreaHeader(areaName: string, y: number) {
    pdf.setFillColor(59, 130, 246);
    pdf.rect(margin, y - 4, contentWidth, 10, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(areaName, margin + 3, y + 2);
    pdf.setTextColor(0, 0, 0);
    return y + 12;
  }

  function estimatePhotoBlockHeight(photoCount: number) {
    if (photoCount === 0) return 0;
    const rows = Math.ceil(photoCount / photosPerRow);
    return 3 + rows * (photoHeight + 3);
  }

  function renderPhotos(photos: string[], startY: number) {
    let currentY = startY + 1.5;
    for (let index = 0; index < photos.length; index++) {
      const col = index % photosPerRow;
      const row = Math.floor(index / photosPerRow);
      const x = margin + col * (photoWidth + photoGap);
      const y = currentY + row * (photoHeight + 3);
      try {
        pdf.addImage(photos[index], 'JPEG', x, y, photoWidth, photoHeight);
      } catch {
        pdf.setFillColor(225, 225, 225);
        pdf.rect(x, y, photoWidth, photoHeight, 'F');
      }
    }
    return currentY + Math.ceil(photos.length / photosPerRow) * (photoHeight + 3);
  }

  // Cover page
  let coverY = 25;

  // Add logo at top (maintaining proportions)
  if (logo.base64) {
    try {
      pdf.addImage(logo.base64, 'PNG', pageWidth / 2 - logo.width / 2, coverY, logo.width, logo.height);
      coverY += logo.height + 15;
    } catch (e) {
      coverY += 10;
    }
  }

  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PunchList Report', pageWidth / 2, coverY, { align: 'center' });
  coverY += 20;

  pdf.setFontSize(18);
  pdf.text(project.projectName, pageWidth / 2, coverY, { align: 'center' });
  coverY += 15;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');

  if (project.address) {
    pdf.text(`Address: ${project.address}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 8;
  }

  if (project.inspector) {
    pdf.text(`Inspector: ${project.inspector}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 8;
  }

  pdf.text(`Date: ${new Date(project.date).toLocaleDateString()}`, pageWidth / 2, coverY, { align: 'center' });
  coverY += 8;

  if (project.gcName) {
    pdf.text(`GC: ${project.gcName}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 8;
  }

  const inspectedAreaNames = project.areas
    .map((area) => area.name.trim())
    .filter((name) => name.length > 0);
  if (inspectedAreaNames.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Areas Inspected:', pageWidth / 2, coverY, { align: 'center' });
    coverY += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    inspectedAreaNames.forEach((name, index) => {
      const line = `${index + 1}. ${name}`;
      const areaLines = pdf.splitTextToSize(line, contentWidth - 20) as string[];
      pdf.text(areaLines, margin + 10, coverY);
      coverY += areaLines.length * 5 + 1;
    });
    coverY += 2;
  }

  // Each area with issues starts on a new page
  for (const area of project.areas) {
    const printableLocations = area.locations
      .filter((location) => !isGeneralNotesLocation(location))
      .map((location) => ({
        ...location,
        items: location.items
          .map((item) => ({
            ...item,
            checkpoints: item.checkpoints.filter((checkpoint) => checkpointHasIssue(checkpoint)),
          }))
          .filter((item) => item.checkpoints.length > 0),
      }))
      .filter((location) => location.items.length > 0);

    if (printableLocations.length === 0) {
      continue;
    }

    pdf.addPage();
    let y = drawAreaHeader(area.name, contentTopMargin);

    for (const location of printableLocations) {
      let locationHeight = 8;
      for (const item of location.items) {
        locationHeight += 6;
        for (const checkpoint of item.checkpoints) {
          locationHeight += 6;
          if (checkpoint.comments) {
            const commentLines = pdf.splitTextToSize(`"${checkpoint.comments}"`, contentWidth - 18) as string[];
            locationHeight += commentLines.length * 4;
          }
          const checkpointFiles = checkpoint.files ?? [];
          if (checkpointFiles.length > 0) {
            const fileLines = pdf.splitTextToSize(`Files: ${checkpointFiles.map((file) => file.name).join(', ')}`, contentWidth - 18) as string[];
            locationHeight += fileLines.length * 4;
          }
          locationHeight += estimatePhotoBlockHeight(checkpoint.photos.length);
          locationHeight += 2;
        }
      }

      if (y + locationHeight > pageHeight - margin) {
        pdf.addPage();
        y = drawAreaHeader(area.name, contentTopMargin);
      }

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y - 3, contentWidth, 6, 'F');
      pdf.text(location.name, margin + 2, y);
      y += 7;

      for (const item of location.items) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`• ${item.name}`, margin + 2, y);
        y += 5;

        for (const checkpoint of item.checkpoints) {
          const checkpointPhotos = checkpoint.photos
            .map((photo) => photo.imageData || photo.thumbnail)
            .filter((photo): photo is string => Boolean(photo));
          const checkpointFiles = checkpoint.files ?? [];
          const commentLines = checkpoint.comments
            ? (pdf.splitTextToSize(`"${checkpoint.comments}"`, contentWidth - 18) as string[])
            : [];
          const fileLines = checkpointFiles.length > 0
            ? (pdf.splitTextToSize(`Files: ${checkpointFiles.map((file) => file.name).join(', ')}`, contentWidth - 18) as string[])
            : [];

          const estimatedHeight =
            5 +
            commentLines.length * 4 +
            fileLines.length * 4 +
            estimatePhotoBlockHeight(checkpointPhotos.length) +
            2;

          if (y + estimatedHeight > pageHeight - margin) {
            pdf.addPage();
            y = drawAreaHeader(area.name, contentTopMargin);
          }

          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          drawStatusIcon('needsReview', margin + 6, y);
          pdf.text(checkpoint.name, margin + 12, y);
          y += 4;

          if (commentLines.length > 0) {
            pdf.setTextColor(100, 100, 100);
            pdf.text(commentLines, margin + 12, y);
            y += commentLines.length * 4;
            pdf.setTextColor(0, 0, 0);
          }

          if (fileLines.length > 0) {
            pdf.setTextColor(80, 80, 80);
            pdf.text(fileLines, margin + 12, y);
            y += fileLines.length * 4;
            pdf.setTextColor(0, 0, 0);
          }

          if (checkpointPhotos.length > 0) {
            y = renderPhotos(checkpointPhotos, y);
          }

          y += 3;
        }

        y += 1;
      }

      y += 2;
    }
  }

  addProjectPageHeader(pdf, project.projectName, logo, coverPage, startPage, pdf.getNumberOfPages());

}

export async function generateProjectPDF(project: Project): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogoAssets();
  renderProjectToPdf(pdf, project, logo);
  addFooter(pdf, 15);

  return pdf.output('blob');
}

export async function generateMultiProjectPDF(projects: Project[]): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogoAssets();

  projects.forEach((project, index) => {
    if (index > 0) {
      pdf.addPage();
    }
    renderProjectToPdf(pdf, project, logo);
  });

  addFooter(pdf, 15);
  return pdf.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
