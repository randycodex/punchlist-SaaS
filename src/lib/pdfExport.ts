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
  areaId: string;
  areaName: string;
  issueCount: number;
  sections: Array<{
    sectionName: string;
    issueCount: number;
    entries: Array<{
      subItem: string;
      comment: string;
    }>;
  }>;
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
  const margin = 12;
  const headerHeight = 14;
  const footerHeight = 34;
  const contentTop = margin + headerHeight;
  const contentBottom = pageHeight - margin - footerHeight;
  const contentWidth = pageWidth - margin * 2;
  const detailColumnGap = 6;
  const detailColumnsPerPage = 1;
  const detailColumnWidth = (contentWidth - detailColumnGap * (detailColumnsPerPage - 1)) / detailColumnsPerPage;
  const photoGap = 4;
  const photosPerRow = 4;
  const photoWidth = (detailColumnWidth - photoGap * (photosPerRow - 1)) / photosPerRow;
  const photoHeight = photoWidth * 1.2;

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

async function normalizePhotoForPdf(source: string): Promise<{ src: string; size: ImageSize }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, img.width);
        canvas.height = Math.max(1, img.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ src: source, size: { width: img.width, height: img.height } });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          src: canvas.toDataURL('image/jpeg', 0.82),
          size: { width: img.width, height: img.height },
        });
      } catch {
        resolve({ src: source, size: { width: img.width, height: img.height } });
      }
    };
    img.onerror = () => resolve({ src: source, size: { width: 1, height: 1 } });
    img.src = source;
  });
}

async function preparePdfPhotos(photos: string[]) {
  return Promise.all(photos.map((photo) => normalizePhotoForPdf(photo)));
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
    const footerFieldsY = layout.pageHeight - layout.margin - 10;
    const dividerY = layout.pageHeight - layout.margin - 5;
    const footerTextY = layout.pageHeight - layout.margin - 1.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text('GC to complete below', layout.margin, footerFieldsY - 4);
    pdf.text('Date Completed', layout.margin, footerFieldsY);
    pdf.line(layout.margin + 28, footerFieldsY + 0.3, layout.margin + 64, footerFieldsY + 0.3);
    pdf.text('Name', layout.margin + 68, footerFieldsY);
    pdf.line(layout.margin + 81, footerFieldsY + 0.3, layout.margin + 145, footerFieldsY + 0.3);
    pdf.text('Signature', layout.margin + 149, footerFieldsY);
    pdf.line(layout.margin + 167, footerFieldsY + 0.3, layout.pageWidth - layout.margin, footerFieldsY + 0.3);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(
      layout.margin,
      dividerY,
      layout.pageWidth - layout.margin,
      dividerY
    );
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Generated ${generatedAt}`, layout.margin, footerTextY);
    pdf.text(`Page ${page} of ${totalPages}`, layout.pageWidth - layout.margin, footerTextY, {
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
  }

  pdf.setTextColor(0, 0, 0);
}

function drawAreaHeader(pdf: jsPDF, areaName: string, y: number, layout: LayoutMetrics) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(71, 85, 105);
  pdf.text(areaName, layout.margin, y);
  pdf.setTextColor(0, 0, 0);
  return y + 8;
}

const SECTION_GAP = 6;
const GROUP_GAP = 4;
const ITEM_GAP = 3;
const GROUP_TO_ITEM_GAP = 4.5;
const GROUP_INDENT = 5;
const ITEM_INDENT = 10;
const BODY_INDENT = 14;
const IMAGE_RADIUS = 1.8;

function isGeneralNotesLocation(location: Location | ExportLocation) {
  const locationName = location.name.trim().toLowerCase();
  if (locationName !== 'other') return false;
  if (location.items.length !== 1) return false;
  const item = location.items[0];
  if (item.name.trim().toLowerCase() !== 'general notes') return false;
  return item.checkpoints.length === 1 && item.checkpoints[0].name.trim().toLowerCase() === 'notes';
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

function getPhotoGridMetrics(layout: LayoutMetrics, availableWidth: number) {
  const photosPerRow = 3;
  const photoGap = 4;
  const photoWidth = (availableWidth - photoGap * (photosPerRow - 1)) / photosPerRow;
  const photoHeight = photoWidth * 1.18;
  const rowGap = 4;
  return { photosPerRow, photoGap, photoWidth, photoHeight, rowGap };
}

function estimatePhotoBlockHeight(photoCount: number, layout: LayoutMetrics, availableWidth: number) {
  if (photoCount === 0) return 0;
  const grid = getPhotoGridMetrics(layout, availableWidth);
  const rows = Math.ceil(photoCount / grid.photosPerRow);
  return 4 + rows * grid.photoHeight + Math.max(rows - 1, 0) * grid.rowGap + 6;
}

function estimateCheckpointBlockHeight(pdf: jsPDF, checkpoint: Checkpoint, layout: LayoutMetrics, textWidth: number) {
  const notesLines = getCheckpointNotesLines(pdf, checkpoint, textWidth);
  const fileLines = getCheckpointFileLines(pdf, checkpoint, textWidth);
  const photoCount = getCheckpointPhotoSources(checkpoint).length;
  return 4.8 + notesLines.length * 3.5 + fileLines.length * 3.4 + estimatePhotoBlockHeight(photoCount, layout, textWidth) + ITEM_GAP;
}

function estimateItemBlockHeight(pdf: jsPDF, item: ExportItem, layout: LayoutMetrics) {
  let height = GROUP_TO_ITEM_GAP + 1.6;
  for (const checkpoint of item.checkpoints) {
    height += estimateCheckpointBlockHeight(pdf, checkpoint, layout, layout.detailColumnWidth - 20);
  }
  return height + 1.6;
}

function estimateLocationBlockHeight(pdf: jsPDF, location: ExportLocation, layout: LayoutMetrics) {
  let height = 7;
  for (const item of location.items) {
    height += estimateItemBlockHeight(pdf, item, layout);
  }
  return height + 3;
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
    const sections: Array<{
      sectionName: string;
      issueCount: number;
      entries: Array<{
        subItem: string;
        comment: string;
      }>;
    }> = [];

    for (const location of area.locations) {
      let sectionIssueCount = 0;
      const entries: Array<{ subItem: string; comment: string }> = [];

      for (const item of location.items) {
        for (const checkpoint of item.checkpoints) {
          if (!checkpointHasIssue(checkpoint)) continue;
          totalIssues += 1;
          areaIssueCount += 1;
          sectionIssueCount += 1;
          areasWithIssues.add(area.id);

          entries.push({
            subItem: `${item.name} - ${checkpoint.name}`,
            comment: sanitizeText(checkpoint.comments),
          });
        }
      }

      if (sectionIssueCount > 0) {
        sections.push({ sectionName: location.name, issueCount: sectionIssueCount, entries });
      }
    }

    if (areaIssueCount > 0) {
      areas.push({
        areaId: area.id,
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
  let logoCenterY = y;

  if (logo.base64) {
    try {
      contentTopY = y - 2;
      pdf.addImage(logo.base64, 'PNG', logoX, contentTopY, logo.width, logo.height);
      titleX = logoX + logo.width + 6;
      logoCenterY = contentTopY + logo.height / 2;
    } catch {
      titleX = layout.margin;
    }
  }

  const metadata = [
    sanitizeText(project.address) ? `Address: ${sanitizeText(project.address)}` : '',
    sanitizeText(project.inspector) ? `Inspector: ${sanitizeText(project.inspector)}` : '',
    `Date: ${formatDate(project.date) || 'N/A'}`,
    sanitizeText(project.gcName) ? `GC: ${sanitizeText(project.gcName)}` : '',
  ].filter(Boolean);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(71, 85, 105);
  const titleLines = pdf.splitTextToSize(`${project.projectName} | PUNCHLIST`, layout.pageWidth - titleX - layout.margin) as string[];

  pdf.setFontSize(8.75);
  const metadataLine = metadata.join(' | ');
  const metadataLines = pdf.splitTextToSize(metadataLine, layout.pageWidth - titleX - layout.margin) as string[];

  const titleBlockHeight = titleLines.length * 6.5;
  const metadataBlockHeight = metadataLines.length > 0 ? metadataLines.length * 4.5 : 0;
  const interBlockGap = metadataLines.length > 0 ? 2 : 0;
  const textBlockHeight = titleBlockHeight + interBlockGap + metadataBlockHeight;
  const titleBaselineY = logo.base64
    ? logoCenterY - textBlockHeight / 2 + 5.5
    : contentTopY + 5.5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(titleLines, titleX, titleBaselineY);
  y = titleBaselineY + titleBlockHeight - 1.5;

  if (metadataLines.length > 0) {
    pdf.setFontSize(8.75);
    pdf.text(metadataLines, titleX, y + interBlockGap);
    y += interBlockGap + metadataBlockHeight;
  }

  y += 4;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(layout.margin, y, layout.pageWidth - layout.margin, y);
  y += 4;
  pdf.setTextColor(0, 0, 0);

  return y + 4;
}

function renderIntroPages(
  pdf: jsPDF,
  project: ExportProject,
  mode: PdfExportMode,
  logo: LogoAssets,
  layout: LayoutMetrics
) {
  return renderCoverPage(pdf, project, mode, logo, layout);
}

function getAreaSummaryColumns(layout: LayoutMetrics) {
  const tableWidth = layout.contentWidth;
  const sectionColumnWidth = 34;
  const countColumnWidth = 14;
  const detailsWidth = tableWidth - sectionColumnWidth - countColumnWidth - 4;
  const subItemColumnWidth = Math.max(38, detailsWidth * 0.5);
  const commentsColumnWidth = Math.max(28, detailsWidth - subItemColumnWidth);
  return { tableWidth, sectionColumnWidth, subItemColumnWidth, commentsColumnWidth };
}

function estimateAreaSummaryHeight(pdf: jsPDF, areaSummary: SummaryArea | undefined, layout: LayoutMetrics) {
  if (!areaSummary || areaSummary.sections.length === 0) return 0;

  const { subItemColumnWidth, commentsColumnWidth } = getAreaSummaryColumns(layout);
  return 6 + 5 + areaSummary.sections.reduce((total, section) => {
    const entryLines = section.entries.reduce((linesTotal, entry) => {
      const subItemLines = pdf.splitTextToSize(entry.subItem, subItemColumnWidth - 2) as string[];
      const commentLines = entry.comment
        ? (pdf.splitTextToSize(entry.comment, commentsColumnWidth - 2) as string[])
        : [];
      return linesTotal + Math.max(1, subItemLines.length, commentLines.length);
    }, 0);
    return total + Math.max(6.5, entryLines * 4.1 + 1.5) + 3;
  }, 0) + 3;
}

function renderAreaSummaryBlock(
  pdf: jsPDF,
  areaSummary: SummaryArea | undefined,
  layout: LayoutMetrics,
  startY: number
) {
  if (!areaSummary || areaSummary.sections.length === 0) {
    return startY;
  }

  const { tableWidth, sectionColumnWidth, subItemColumnWidth, commentsColumnWidth } = getAreaSummaryColumns(layout);
  let y = startY;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Summary', layout.margin, y);
  y += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.8);
  pdf.text('AREA', layout.margin + 0.5, y);
  pdf.text('INSPECTED ITEM', layout.margin + 0.5 + sectionColumnWidth, y);
  pdf.text('COMMENTS', layout.margin + 0.5 + sectionColumnWidth + subItemColumnWidth, y);
  pdf.text('ISSUES QTY', layout.margin + tableWidth - 1, y, { align: 'right' });
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.1);
  pdf.setTextColor(55, 65, 81);

  for (const section of areaSummary.sections) {
    const entryLines = section.entries.reduce((linesTotal, entry) => {
      const subItemLines = pdf.splitTextToSize(entry.subItem, subItemColumnWidth - 2) as string[];
      const commentLines = entry.comment
        ? (pdf.splitTextToSize(entry.comment, commentsColumnWidth - 2) as string[])
        : [];
      return linesTotal + Math.max(1, subItemLines.length, commentLines.length);
    }, 0);
    const rowHeight = Math.max(6.5, entryLines * 4.1 + 1.5);
    const rowTextY = y;
    const sectionX = layout.margin + 0.5;
    const subItemX = sectionX + sectionColumnWidth;
    const commentsX = subItemX + subItemColumnWidth;
    const countX = layout.margin + tableWidth - 1;

    pdf.text(section.sectionName, sectionX, rowTextY);

    let entryY = rowTextY;
    for (const entry of section.entries) {
      const subItemLines = pdf.splitTextToSize(entry.subItem, subItemColumnWidth - 2) as string[];
      const commentLines = entry.comment
        ? (pdf.splitTextToSize(entry.comment, commentsColumnWidth - 2) as string[])
        : [];
      const usedLines = Math.max(1, subItemLines.length, commentLines.length);

      pdf.text(subItemLines, subItemX, entryY);
      if (commentLines.length > 0) {
        pdf.text(commentLines, commentsX, entryY);
      }
      entryY += usedLines * 4.1;
    }

    pdf.text(String(section.issueCount), countX, rowTextY, { align: 'right' });
    y += rowHeight + 3;
  }

  pdf.setTextColor(0, 0, 0);
  return y + 2;
}

function renderPhotos(
  pdf: jsPDF,
  photos: Array<{ src: string; size: ImageSize }>,
  startX: number,
  startY: number,
  layout: LayoutMetrics,
  availableWidth: number
) {
  const grid = getPhotoGridMetrics(layout, availableWidth);
  const y = startY + 1;

  for (let index = 0; index < photos.length; index += 1) {
    const col = index % grid.photosPerRow;
    const row = Math.floor(index / grid.photosPerRow);
    const x = startX + col * (grid.photoWidth + grid.photoGap);
    const imageY = y + row * (grid.photoHeight + grid.rowGap);
    const fitted = fitImageSize(photos[index]?.size ?? { width: 1, height: 1 }, grid.photoWidth, grid.photoHeight);
    const imageX = x + (grid.photoWidth - fitted.width) / 2;
    const fittedY = imageY;

    try {
      pdf.addImage(photos[index].src, 'JPEG', imageX, fittedY, fitted.width, fitted.height);
    } catch {
      pdf.setFillColor(229, 231, 235);
      pdf.roundedRect(x, imageY, grid.photoWidth, grid.photoHeight, IMAGE_RADIUS, IMAGE_RADIUS, 'F');
    }
  }

  const rows = Math.ceil(photos.length / grid.photosPerRow);
  return y + rows * grid.photoHeight + Math.max(rows - 1, 0) * grid.rowGap + 1.5;
}

async function renderCheckpointBlock(
  pdf: jsPDF,
  checkpoint: ExportCheckpoint,
  startX: number,
  y: number,
  layout: LayoutMetrics
) {
  const textWidth = layout.contentWidth - BODY_INDENT - 2;
  const noteLines = getCheckpointNotesLines(pdf, checkpoint, textWidth);
  const fileLines = getCheckpointFileLines(pdf, checkpoint, textWidth);
  const photos = await preparePdfPhotos(getCheckpointPhotoSources(checkpoint));
  const itemX = startX + ITEM_INDENT;
  const bodyX = startX + BODY_INDENT;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  drawStatusIcon(pdf, checkpoint, itemX, y, layout.statusIconRadius);
  pdf.text(checkpoint.name, itemX + 4, y);
  y += 4;

  if (noteLines.length > 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
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
    y = renderPhotos(pdf, photos, bodyX, y, layout, layout.contentWidth - BODY_INDENT - 2);
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
  const summaryByArea = new Map(getProjectIssueSummary(project).areas.map((area) => [area.areaId, area] as const));

  const introEndY = renderIntroPages(pdf, project, mode, logo, layout);
  let firstAreaStartsOnCurrentPage = true;

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

    const areaSummary = summaryByArea.get(area.id);
    const drawAreaIntro = (baseY: number, includeSummary: boolean) => {
      let y = drawAreaHeader(pdf, area.name, baseY, layout);
      if (sanitizeText(area.notes)) {
        const noteLines = pdf.splitTextToSize(sanitizeText(area.notes), layout.contentWidth - 2) as string[];
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8.5);
        pdf.setTextColor(107, 114, 128);
        pdf.text(noteLines, layout.margin, y);
        pdf.setTextColor(0, 0, 0);
        y += noteLines.length * 3.8 + 3;
      }
      if (includeSummary) {
        y = renderAreaSummaryBlock(pdf, areaSummary, layout, y);
      }
      return y;
    };
    const startAreaPage = (includeSummary: boolean) => {
      if (firstAreaStartsOnCurrentPage) {
        firstAreaStartsOnCurrentPage = false;
        return drawAreaIntro(introEndY, includeSummary);
      }
      pdf.addPage();
      return drawAreaIntro(layout.contentTop, includeSummary);
    };
    const drawLocationHeader = (name: string, y: number) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(71, 85, 105);
      pdf.text(name, layout.margin, y);
      pdf.setTextColor(0, 0, 0);
      return y + 7.5;
    };

    const getFreshAreaStartY = (baseY: number, includeSummary: boolean) => {
      let freshY = baseY + 8;
      if (sanitizeText(area.notes)) {
        const noteLines = pdf.splitTextToSize(sanitizeText(area.notes), layout.contentWidth - 2) as string[];
        freshY += noteLines.length * 3.8 + 3;
      }
      if (includeSummary) {
        freshY += estimateAreaSummaryHeight(pdf, areaSummary, layout);
      }
      return freshY;
    };

    let y = startAreaPage(true);
    const continuedAreaStartY = getFreshAreaStartY(layout.contentTop, false);

    for (const location of printableLocations) {
      const locationHeight = estimateLocationBlockHeight(pdf, location, layout);
      const maxLocationHeightOnFreshPage = layout.contentBottom - continuedAreaStartY;
      if (locationHeight <= maxLocationHeightOnFreshPage && y + locationHeight > layout.contentBottom) {
        y = startAreaPage(false);
      }

      const firstItem = location.items[0];
      const firstItemHeight = firstItem ? estimateItemBlockHeight(pdf, firstItem, layout) : 0;
      const locationHeaderHeight = 7.5;
      const maxFirstItemHeightOnFreshPage = layout.contentBottom - (continuedAreaStartY + locationHeaderHeight);
      if (
        firstItem &&
        firstItemHeight <= maxFirstItemHeightOnFreshPage &&
        y + locationHeaderHeight + firstItemHeight > layout.contentBottom
      ) {
        y = startAreaPage(false);
      }

      y = drawLocationHeader(location.name, y);

      for (const item of location.items) {
        const itemHeight = estimateItemBlockHeight(pdf, item, layout);
        const maxItemHeightOnFreshPage = layout.contentBottom - (continuedAreaStartY + locationHeaderHeight);
        if (itemHeight <= maxItemHeightOnFreshPage && y + itemHeight > layout.contentBottom) {
          y = startAreaPage(false);
          y = drawLocationHeader(location.name, y);
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(item.name, layout.margin + GROUP_INDENT, y);
        y += GROUP_TO_ITEM_GAP;

        for (const checkpoint of item.checkpoints) {
          const checkpointHeight = estimateCheckpointBlockHeight(pdf, checkpoint, layout, layout.contentWidth - BODY_INDENT - 2);
          const itemHeaderHeight = GROUP_TO_ITEM_GAP + 1;
          const maxCheckpointHeightOnFreshPage = layout.contentBottom - (continuedAreaStartY + locationHeaderHeight + itemHeaderHeight);
          if (checkpointHeight <= maxCheckpointHeightOnFreshPage && y + checkpointHeight > layout.contentBottom) {
            y = startAreaPage(false);
            y = drawLocationHeader(location.name, y);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text(item.name, layout.margin + GROUP_INDENT, y);
            y += GROUP_TO_ITEM_GAP;
          }

          y = await renderCheckpointBlock(
            pdf,
            checkpoint,
            layout.margin,
            y,
            layout
          );
        }

        y += GROUP_GAP;
      }

      y += SECTION_GAP;
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
