import { jsPDF } from 'jspdf';
import { Area, Checkpoint, Item, Location, Project, checkpointHasIssue, getCheckpointIssueState } from '@/types';

export type PdfExportMode = 'full' | 'issues';

type ImageSize = { width: number; height: number };

type LogoAssets = {
  base64: string | null;
  width: number;
  height: number;
};

type LayoutMetrics = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  headerHeight: number;
  footerHeight: number;
  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  detailColumnGap: number;
  detailColumnsPerPage: number;
  detailColumnWidth: number;
  photoGap: number;
  photosPerRow: number;
  photoWidth: number;
  photoHeight: number;
  statusIconRadius: number;
};

type ExportProject = Omit<Project, 'areas'> & { areas: ExportArea[] };
type ExportArea = Omit<Area, 'locations'> & { locations: ExportLocation[] };
type ExportLocation = Omit<Location, 'items'> & { items: ExportItem[] };
type ExportItem = Omit<Item, 'checkpoints'> & { checkpoints: ExportCheckpoint[] };
type ExportCheckpoint = Checkpoint;

type SummaryArea = {
  areaName: string;
  issueCount: number;
  sections: Array<{ sectionName: string; issueCount: number }>;
};

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

function getImageDimensions(base64: string): Promise<ImageSize> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = base64;
  });
}

async function loadLogoAssets(): Promise<LogoAssets> {
  const base64 = await loadLogoBase64();
  let width = 30;
  let height = 30;

  if (base64) {
    try {
      const dims = await getImageDimensions(base64);
      const maxLogoHeight = 15;
      const aspectRatio = dims.width / dims.height;
      height = maxLogoHeight;
      width = maxLogoHeight * aspectRatio;
    } catch {
      // Keep defaults.
    }
  }

  return { base64, width, height };
}

function createLayout(pdf: jsPDF): LayoutMetrics {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const headerHeight = 14;
  const footerHeight = 14;
  const contentTop = margin + headerHeight;
  const contentBottom = pageHeight - margin - footerHeight;
  const contentWidth = pageWidth - margin * 2;
  const detailColumnGap = 6;
  const detailColumnsPerPage = 2;
  const detailColumnWidth = (contentWidth - detailColumnGap * (detailColumnsPerPage - 1)) / detailColumnsPerPage;
  const photoGap = 4;
  const photosPerRow = 1;
  const photoWidth = (detailColumnWidth - photoGap * (photosPerRow - 1)) / photosPerRow;
  const photoHeight = photoWidth * 0.68;

  return {
    pageWidth,
    pageHeight,
    margin,
    headerHeight,
    footerHeight,
    contentTop,
    contentBottom,
    contentWidth,
    detailColumnGap,
    detailColumnsPerPage,
    detailColumnWidth,
    photoGap,
    photosPerRow,
    photoWidth,
    photoHeight,
    statusIconRadius: 1.6,
  };
}

function sanitizeText(value: string | undefined | null) {
  return (value ?? '').trim();
}

function formatDate(value: Date | string | number | undefined, withTime = false) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

function getGeneratedAt() {
  return formatDate(new Date(), true);
}

function fitImageSize(size: ImageSize, maxWidth: number, maxHeight: number): ImageSize {
  if (size.width <= 0 || size.height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
  return { width: size.width * scale, height: size.height * scale };
}

async function loadPhotoDimensions(photos: string[]) {
  return Promise.all(
    photos.map(async (photo) => {
      try {
        return await getImageDimensions(photo);
      } catch {
        return { width: 1, height: 1 };
      }
    })
  );
}

function drawStatusIcon(pdf: jsPDF, checkpoint: Checkpoint, x: number, y: number, radius: number) {
  const centerY = y - 1.5;
  const issueState = getCheckpointIssueState(checkpoint);

  pdf.setLineWidth(0.35);

  if (issueState === 'open') {
    pdf.setDrawColor(239, 78, 36);
    pdf.setFillColor(239, 78, 36);
    pdf.circle(x, centerY, radius, 'F');
  } else if (issueState === 'resolved') {
    pdf.setDrawColor(217, 119, 6);
    pdf.setFillColor(217, 119, 6);
    pdf.circle(x, centerY, radius, 'F');
  } else if (issueState === 'verified') {
    pdf.setDrawColor(22, 163, 74);
    pdf.setFillColor(22, 163, 74);
    pdf.circle(x, centerY, radius, 'F');
  } else if (checkpoint.status === 'ok') {
    pdf.setDrawColor(51, 65, 85);
    pdf.circle(x, centerY, radius, 'S');
  } else {
    pdf.setDrawColor(148, 163, 184);
    pdf.circle(x, centerY, radius, 'S');
  }

  pdf.setDrawColor(0, 0, 0);
  pdf.setFillColor(0, 0, 0);
}

function addFooter(pdf: jsPDF, layout: LayoutMetrics, generatedAt: string) {
  const totalPages = pdf.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(
      layout.margin,
      layout.pageHeight - layout.margin - 7,
      layout.pageWidth - layout.margin,
      layout.pageHeight - layout.margin - 7
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Generated ${generatedAt}`, layout.margin, layout.pageHeight - layout.margin - 2);
    pdf.text(`Page ${page} of ${totalPages}`, layout.pageWidth - layout.margin, layout.pageHeight - layout.margin - 2, {
      align: 'right',
    });
  }

  pdf.setTextColor(0, 0, 0);
}

function addProjectPageHeader(
  pdf: jsPDF,
  projectName: string,
  logo: LogoAssets,
  coverPage: number,
  startPage: number,
  endPage: number,
  layout: LayoutMetrics
) {
  const logoHeight = 5;
  const logoWidth = logo.height > 0 ? (logo.width / logo.height) * logoHeight : logoHeight;
  const logoY = layout.margin - 1;
  const textY = layout.margin + 3;

  for (let page = startPage; page <= endPage; page += 1) {
    if (page === coverPage) continue;

    pdf.setPage(page);
    let textX = layout.margin;

    if (logo.base64) {
      try {
        pdf.addImage(logo.base64, 'PNG', layout.margin, logoY, logoWidth, logoHeight);
        textX = layout.margin + logoWidth + 3;
      } catch {
        textX = layout.margin;
      }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(projectName, textX, textY);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(layout.margin, layout.margin + layout.headerHeight - 3, layout.pageWidth - layout.margin, layout.margin + layout.headerHeight - 3);
  }

  pdf.setTextColor(0, 0, 0);
}

function drawSectionTitle(pdf: jsPDF, title: string, y: number, layout: LayoutMetrics) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(71, 85, 105);
  pdf.text(title, layout.margin, y);
  pdf.setDrawColor(226, 232, 240);
  pdf.line(layout.margin, y + 1.5, layout.pageWidth - layout.margin, y + 1.5);
  pdf.setTextColor(0, 0, 0);
  return y + 8;
}

function drawAreaHeader(pdf: jsPDF, areaName: string, y: number, layout: LayoutMetrics) {
  pdf.setFillColor(100, 116, 139);
  pdf.roundedRect(layout.margin, y - 4, layout.contentWidth, 10, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text(areaName, layout.margin + 3, y + 2);
  pdf.setTextColor(0, 0, 0);
  return y + 12;
}

const SECTION_GAP = 5;
const GROUP_GAP = 3.2;
const ITEM_GAP = 2.2;
const GROUP_TO_ITEM_GAP = 5.4;
const GROUP_INDENT = 3.5;
const ITEM_INDENT = 7.5;
const BODY_INDENT = 11;
const IMAGE_RADIUS = 1.8;

function isGeneralNotesLocation(location: Location | ExportLocation) {
  const locationName = location.name.trim().toLowerCase();
  if (locationName !== 'other') return false;
  if (location.items.length !== 1) return false;
  const item = location.items[0];
  if (item.name.trim().toLowerCase() !== 'general notes') return false;
  return item.checkpoints.length === 1 && item.checkpoints[0].name.trim().toLowerCase() === 'notes';
}

function estimatePhotoBlockHeight(photoCount: number, layout: LayoutMetrics) {
  if (photoCount === 0) return 0;
  const rows = Math.ceil(photoCount / layout.photosPerRow);
  return 3 + rows * (layout.photoHeight + 6) + 3;
}

function getCheckpointNotesLines(pdf: jsPDF, checkpoint: Checkpoint, textWidth: number) {
  const notes = sanitizeText(checkpoint.comments);
  return notes ? (pdf.splitTextToSize(notes, textWidth) as string[]) : [];
}

function getCheckpointFileLines(pdf: jsPDF, checkpoint: Checkpoint, textWidth: number) {
  const fileNames = (checkpoint.files ?? []).map((file) => file.name).filter(Boolean);
  return fileNames.length > 0 ? (pdf.splitTextToSize(`Files: ${fileNames.join(', ')}`, textWidth) as string[]) : [];
}

function getCheckpointPhotoSources(checkpoint: Checkpoint) {
  return checkpoint.photos
    .map((photo) => photo.imageData || photo.thumbnail)
    .filter((photo): photo is string => Boolean(photo));
}

function estimateCheckpointBlockHeight(pdf: jsPDF, checkpoint: Checkpoint, layout: LayoutMetrics, textWidth: number) {
  const notesLines = getCheckpointNotesLines(pdf, checkpoint, textWidth);
  const fileLines = getCheckpointFileLines(pdf, checkpoint, textWidth);
  const photoCount = getCheckpointPhotoSources(checkpoint).length;
  return 4.8 + notesLines.length * 3.5 + fileLines.length * 3.4 + estimatePhotoBlockHeight(photoCount, layout) + ITEM_GAP;
}

function estimateItemBlockHeight(pdf: jsPDF, item: ExportItem, layout: LayoutMetrics) {
  let height = GROUP_TO_ITEM_GAP + 1.6;
  for (const checkpoint of item.checkpoints) {
    height += estimateCheckpointBlockHeight(pdf, checkpoint, layout, layout.detailColumnWidth - 20);
  }
  return height + 1.6;
}

function estimateLocationBlockHeight(pdf: jsPDF, location: ExportLocation, layout: LayoutMetrics) {
  let height = 9;
  for (const item of location.items) {
    height += estimateItemBlockHeight(pdf, item, layout);
  }
  return height + 2.5;
}

function getActiveAreas(project: Project) {
  return project.areas.filter((area) => !area.deletedAt);
}

function filterProjectForMode(project: Project, mode: PdfExportMode): ExportProject {
  const activeAreas = getActiveAreas(project);

  if (mode === 'full') {
    return {
      ...project,
      areas: activeAreas.map((area) => ({
        ...area,
        locations: area.locations.map((location) => ({
          ...location,
          items: location.items.map((item) => ({
            ...item,
            checkpoints: [...item.checkpoints],
          })),
        })),
      })),
    };
  }

  return {
    ...project,
    areas: activeAreas
      .map((area) => ({
        ...area,
        locations: area.locations
          .map((location) => ({
            ...location,
            items: location.items
              .map((item) => ({
                ...item,
                checkpoints: item.checkpoints.filter((checkpoint) => checkpointHasIssue(checkpoint)),
              }))
              .filter((item) => item.checkpoints.length > 0),
          }))
          .filter((location) => location.items.length > 0),
      }))
      .filter((area) => area.locations.length > 0),
  };
}

function getProjectIssueSummary(project: Project) {
  const activeAreas = getActiveAreas(project);
  let totalIssues = 0;
  const areasWithIssues = new Set<string>();
  const areas: SummaryArea[] = [];

  for (const area of activeAreas) {
    let areaIssueCount = 0;
    const sections: Array<{ sectionName: string; issueCount: number }> = [];

    for (const location of area.locations) {
      let sectionIssueCount = 0;

      for (const item of location.items) {
        for (const checkpoint of item.checkpoints) {
          if (!checkpointHasIssue(checkpoint)) continue;
          totalIssues += 1;
          areaIssueCount += 1;
          sectionIssueCount += 1;
          areasWithIssues.add(area.id);
        }
      }

      if (sectionIssueCount > 0) {
        sections.push({ sectionName: location.name, issueCount: sectionIssueCount });
      }
    }

    if (areaIssueCount > 0) {
      areas.push({
        areaName: area.name,
        issueCount: areaIssueCount,
        sections,
      });
    }
  }

  return {
    totalIssues,
    totalAreasInspected: activeAreas.length,
    totalAreasWithIssues: areasWithIssues.size,
    areas,
  };
}

function renderCoverPage(
  pdf: jsPDF,
  project: ExportProject,
  mode: PdfExportMode,
  logo: LogoAssets,
  layout: LayoutMetrics
) {
  let y = 20;
  const logoX = layout.margin;
  let titleX = layout.margin;
  let contentTopY = y;

  if (logo.base64) {
    try {
      contentTopY = y - 2;
      pdf.addImage(logo.base64, 'PNG', logoX, contentTopY, logo.width, logo.height);
      titleX = logoX + logo.width + 6;
    } catch {
      titleX = layout.margin;
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(71, 85, 105);
  const titleLines = pdf.splitTextToSize(`PunchList Report - ${project.projectName}`, layout.pageWidth - titleX - layout.margin) as string[];
  const titleBaselineY = contentTopY + 5.5;
  pdf.text(titleLines, titleX, titleBaselineY);
  y = titleBaselineY + titleLines.length * 6.5 - 1.5;

  const metadata = [
    sanitizeText(project.address) ? `Address: ${sanitizeText(project.address)}` : '',
    sanitizeText(project.inspector) ? `Inspector: ${sanitizeText(project.inspector)}` : '',
    `Date: ${formatDate(project.date) || 'N/A'}`,
    sanitizeText(project.gcName) ? `GC: ${sanitizeText(project.gcName)}` : '',
  ].filter(Boolean);

  pdf.setFontSize(8.75);
  const metadataLine = metadata.join(' | ');
  const metadataLines = pdf.splitTextToSize(metadataLine, layout.pageWidth - titleX - layout.margin) as string[];
  pdf.text(metadataLines, titleX, y + 1.5);
  y += metadataLines.length * 4.5;

  y += 4;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(layout.margin, y, layout.pageWidth - layout.margin, y);
  y += 4;
  pdf.setTextColor(0, 0, 0);

  return y + 4;
}

function renderAreaNotesSection(pdf: jsPDF, project: ExportProject, layout: LayoutMetrics, startY?: number) {
  const notesAreas = project.areas.filter((area) => sanitizeText(area.notes));
  if (notesAreas.length === 0) return startY ?? layout.contentTop;

  let y = startY ?? layout.contentTop;
  if (!startY) {
    pdf.addPage();
  }
  y = drawSectionTitle(pdf, 'Area Notes', y, layout);

  for (const area of notesAreas) {
    const lines = pdf.splitTextToSize(sanitizeText(area.notes), layout.contentWidth - 6) as string[];
    const blockHeight = 8 + lines.length * 4.5 + 4;

    if (y + blockHeight > layout.contentBottom) {
      pdf.addPage();
      y = drawSectionTitle(pdf, 'Area Notes', layout.contentTop, layout);
    }

    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(layout.margin, y - 5, layout.contentWidth, blockHeight, 1.5, 1.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(area.name, layout.margin + 3, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81);
    pdf.text(lines, layout.margin + 3, y);
    pdf.setTextColor(0, 0, 0);
    y += lines.length * 4.5 + 6;
  }

  return y;
}

function renderSummarySection(pdf: jsPDF, project: ExportProject, layout: LayoutMetrics, startY: number) {
  const summary = getProjectIssueSummary(project);
  let y = drawSectionTitle(pdf, 'Summary', startY, layout);

  if (summary.areas.length === 0) {
    pdf.setFontSize(10);
    pdf.text('No issues recorded.', layout.margin, y);
    pdf.setTextColor(0, 0, 0);
    return y + 6;
  }

  pdf.setFontSize(10);
  pdf.setTextColor(75, 85, 99);

  for (const area of summary.areas) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${area.areaName} - ${area.issueCount}`, layout.margin, y);
    y += 5.5;

    pdf.setFont('helvetica', 'normal');
    area.sections.slice(0, 4).forEach((section) => {
      pdf.text(`- ${section.sectionName} - ${section.issueCount}`, layout.margin + 4, y);
      y += 4.5;
    });

    y += 1.5;
  }

  pdf.setTextColor(0, 0, 0);
  return y;
}

function renderIntroPages(
  pdf: jsPDF,
  project: ExportProject,
  mode: PdfExportMode,
  logo: LogoAssets,
  layout: LayoutMetrics
) {
  let y = renderCoverPage(pdf, project, mode, logo, layout);
  const notesAreas = project.areas.filter((area) => sanitizeText(area.notes));
  const summary = getProjectIssueSummary(project);
  const estimatedSummaryHeight = 34 + summary.areas.reduce((total, area) => total + 7 + Math.min(area.sections.length, 4) * 4.5, 0);
  const estimatedNotesHeight = notesAreas.reduce((total, area) => {
    const lines = pdf.splitTextToSize(sanitizeText(area.notes), layout.contentWidth - 6) as string[];
    return total + 14 + lines.length * 4.5;
  }, 0);

  if (y + estimatedSummaryHeight + estimatedNotesHeight <= layout.contentBottom) {
    y = renderSummarySection(pdf, project, layout, y);
    if (notesAreas.length > 0) {
      renderAreaNotesSection(pdf, project, layout, y + 2);
    }
    return;
  }

  pdf.addPage();
  y = renderSummarySection(pdf, project, layout, layout.contentTop);
  renderAreaNotesSection(pdf, project, layout, y + 2);
}

function renderPhotos(
  pdf: jsPDF,
  photos: string[],
  photoSizes: ImageSize[],
  startX: number,
  startY: number,
  layout: LayoutMetrics
) {
  const currentY = startY + 2.5;

  for (let index = 0; index < photos.length; index += 1) {
    const col = index % layout.photosPerRow;
    const row = Math.floor(index / layout.photosPerRow);
    const x = startX + col * (layout.photoWidth + layout.photoGap);
    const frameY = currentY + row * (layout.photoHeight + 6);

    const fitted = fitImageSize(photoSizes[index] ?? { width: 1, height: 1 }, layout.photoWidth - 2, layout.photoHeight - 2);
    const imageX = x + (layout.photoWidth - fitted.width) / 2;
    const imageY = frameY + (layout.photoHeight - fitted.height) / 2;

    try {
      pdf.addImage(photos[index], 'JPEG', imageX, imageY, fitted.width, fitted.height);
    } catch {
      pdf.setFillColor(229, 231, 235);
      pdf.roundedRect(x, frameY, layout.photoWidth, layout.photoHeight, IMAGE_RADIUS, IMAGE_RADIUS, 'F');
    }
  }

  return currentY + Math.ceil(photos.length / layout.photosPerRow) * (layout.photoHeight + 6) + 3;
}

async function renderCheckpointBlock(
  pdf: jsPDF,
  checkpoint: ExportCheckpoint,
  startX: number,
  y: number,
  layout: LayoutMetrics
) {
  const noteLines = getCheckpointNotesLines(pdf, checkpoint, layout.detailColumnWidth - BODY_INDENT - 2);
  const fileLines = getCheckpointFileLines(pdf, checkpoint, layout.detailColumnWidth - BODY_INDENT - 2);
  const photos = getCheckpointPhotoSources(checkpoint);
  const photoSizes = await loadPhotoDimensions(photos);
  const itemX = startX + ITEM_INDENT;
  const bodyX = startX + BODY_INDENT;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.75);
  drawStatusIcon(pdf, checkpoint, itemX, y, layout.statusIconRadius);
  pdf.text(checkpoint.name, itemX + 4, y);
  y += 3.6;

  if (noteLines.length > 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(noteLines, bodyX, y);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    y += noteLines.length * 3.5;
  }

  if (fileLines.length > 0) {
    pdf.setFontSize(7.8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(fileLines, bodyX, y);
    pdf.setTextColor(0, 0, 0);
    y += fileLines.length * 3.3;
  }

  if (photos.length > 0) {
    y = renderPhotos(pdf, photos, photoSizes, bodyX, y, layout);
  }

  return y + ITEM_GAP;
}

async function renderProjectDetailPages(
  pdf: jsPDF,
  project: ExportProject,
  mode: PdfExportMode,
  logo: LogoAssets,
  layout: LayoutMetrics
) {
  const coverPage = pdf.getNumberOfPages();
  const startPage = coverPage;

  renderIntroPages(pdf, project, mode, logo, layout);

  for (const area of project.areas) {
    if (area.locations.length === 0 && !sanitizeText(area.notes)) {
      continue;
    }

    const printableLocations = mode === 'full'
      ? area.locations.filter((location) => location.items.length > 0 || isGeneralNotesLocation(location))
      : area.locations.filter((location) => location.items.length > 0);

    if (printableLocations.length === 0) {
      continue;
    }

    if (mode === 'full') {
      pdf.addPage();
      let y = drawAreaHeader(pdf, area.name, layout.contentTop, layout);

      for (const location of printableLocations) {
        const locationHeight = estimateLocationBlockHeight(pdf, location, layout);

        if (y + locationHeight > layout.contentBottom) {
          pdf.addPage();
          y = drawAreaHeader(pdf, area.name, layout.contentTop, layout);
        }

        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(layout.margin, y - 4, layout.contentWidth, 8, 1.5, 1.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.25);
        pdf.text(location.name, layout.margin + 4, y);
        y += 9;

        for (const item of location.items) {
          const itemHeight = estimateItemBlockHeight(pdf, item, layout);
          if (y + itemHeight > layout.contentBottom) {
            pdf.addPage();
            y = drawAreaHeader(pdf, area.name, layout.contentTop, layout);
            pdf.setFillColor(241, 245, 249);
            pdf.roundedRect(layout.margin, y - 4, layout.contentWidth, 8, 1.5, 1.5, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10.25);
            pdf.text(location.name, layout.margin + 4, y);
            y += 9;
          }

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.1);
          pdf.text(item.name, layout.margin + GROUP_INDENT, y);
          y += GROUP_TO_ITEM_GAP;

          for (const checkpoint of item.checkpoints) {
            const checkpointHeight = estimateCheckpointBlockHeight(pdf, checkpoint, layout, layout.detailColumnWidth - 20);
            if (y + checkpointHeight > layout.contentBottom) {
              pdf.addPage();
              y = drawAreaHeader(pdf, area.name, layout.contentTop, layout);
              pdf.setFillColor(241, 245, 249);
              pdf.roundedRect(layout.margin, y - 4, layout.contentWidth, 8, 1.5, 1.5, 'F');
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(10.25);
              pdf.text(location.name, layout.margin + 4, y);
              y += 9;
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(9.1);
              pdf.text(item.name, layout.margin + GROUP_INDENT, y);
              y += GROUP_TO_ITEM_GAP;
            }

            y = await renderCheckpointBlock(pdf, checkpoint, layout.margin, y, layout);
          }

          y += GROUP_GAP;
        }

        y += SECTION_GAP;
      }

      continue;
    }

    const getColumnX = (columnIndex: number) => layout.margin + columnIndex * (layout.detailColumnWidth + layout.detailColumnGap);
    const drawLocationHeader = (name: string, startX: number, y: number) => {
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(startX, y - 4, layout.detailColumnWidth, 8, 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.25);
      pdf.text(name, startX + 4, y);
      return y + 9;
    };
    const startAreaPage = () => {
      pdf.addPage();
      const baseY = drawAreaHeader(pdf, area.name, layout.contentTop, layout);
      return new Array(layout.detailColumnsPerPage).fill(baseY);
    };
    const findColumnWithSpace = (columnYs: number[], neededHeight: number) =>
      columnYs.findIndex((columnY) => columnY + neededHeight <= layout.contentBottom);

    let columnYs: number[] | null = null;

    for (const location of printableLocations) {
      if (!columnYs) {
        columnYs = startAreaPage();
      }

      let locationColumnIndex = columnYs.indexOf(Math.min(...columnYs));
      if (columnYs[locationColumnIndex] + 14 > layout.contentBottom) {
        const fallbackColumnIndex = findColumnWithSpace(columnYs, 14);
        if (fallbackColumnIndex >= 0) {
          locationColumnIndex = fallbackColumnIndex;
        } else {
          columnYs = startAreaPage();
          locationColumnIndex = 0;
        }
      }

      const locationStartX = getColumnX(locationColumnIndex);
      columnYs[locationColumnIndex] = drawLocationHeader(location.name, locationStartX, columnYs[locationColumnIndex]);

      for (const item of location.items) {
        const itemHeight = estimateItemBlockHeight(pdf, item, layout);
        if (columnYs[locationColumnIndex] + itemHeight > layout.contentBottom) {
          const fallbackColumnIndex = findColumnWithSpace(columnYs, itemHeight + 8);
          if (fallbackColumnIndex >= 0) {
            locationColumnIndex = fallbackColumnIndex;
          } else {
            columnYs = startAreaPage();
            locationColumnIndex = 0;
          }
        }

        const itemStartX = getColumnX(locationColumnIndex);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.1);
        pdf.text(item.name, itemStartX + GROUP_INDENT, columnYs[locationColumnIndex]);
        columnYs[locationColumnIndex] += GROUP_TO_ITEM_GAP;

        for (const checkpoint of item.checkpoints) {
          const checkpointHeight = estimateCheckpointBlockHeight(pdf, checkpoint, layout, layout.detailColumnWidth - 20);
          if (columnYs[locationColumnIndex] + checkpointHeight > layout.contentBottom) {
            const fallbackColumnIndex = findColumnWithSpace(columnYs, checkpointHeight + 13);
            if (fallbackColumnIndex >= 0) {
              locationColumnIndex = fallbackColumnIndex;
            } else {
              columnYs = startAreaPage();
              locationColumnIndex = 0;
            }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9.1);
            pdf.text(item.name, getColumnX(locationColumnIndex) + GROUP_INDENT, columnYs[locationColumnIndex]);
            columnYs[locationColumnIndex] += GROUP_TO_ITEM_GAP;
          }

          columnYs[locationColumnIndex] = await renderCheckpointBlock(
            pdf,
            checkpoint,
            getColumnX(locationColumnIndex),
            columnYs[locationColumnIndex],
            layout
          );
        }

        columnYs[locationColumnIndex] += GROUP_GAP;
      }

      columnYs[locationColumnIndex] += SECTION_GAP;
    }
  }

  addProjectPageHeader(pdf, project.projectName, logo, coverPage, startPage, pdf.getNumberOfPages(), layout);
}

export async function generateProjectPDF(project: Project, mode: PdfExportMode = 'full'): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogoAssets();
  const layout = createLayout(pdf);
  const exportProject = filterProjectForMode(project, mode);
  const generatedAt = getGeneratedAt();

  await renderProjectDetailPages(pdf, exportProject, mode, logo, layout);
  addFooter(pdf, layout, generatedAt);
  return pdf.output('blob');
}

export async function generateMultiProjectPDF(projects: Project[], mode: PdfExportMode = 'full'): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogoAssets();
  const layout = createLayout(pdf);
  const generatedAt = getGeneratedAt();

  for (const [index, project] of projects.entries()) {
    if (index > 0) {
      pdf.addPage();
    }

    const exportProject = filterProjectForMode(project, mode);
    await renderProjectDetailPages(pdf, exportProject, mode, logo, layout);
  }

  addFooter(pdf, layout, generatedAt);
  return pdf.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
