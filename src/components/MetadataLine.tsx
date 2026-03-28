'use client';

function formatPart(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default function MetadataLine({
  issues = 0,
  notes = 0,
  photos = 0,
  issuesOnly = false,
  className = '',
}: {
  issues?: number;
  notes?: number;
  photos?: number;
  issuesOnly?: boolean;
  className?: string;
}) {
  const parts: Array<{ key: string; text: string; className: string }> = [];

  if (issues > 0) {
    parts.push({
      key: 'issues',
      text: formatPart(issues, 'issue', 'issues'),
      className: 'accent-text',
    });
  }

  if (!issuesOnly && notes > 0) {
    parts.push({
      key: 'notes',
      text: formatPart(notes, 'note', 'notes'),
      className: 'metric-secondary',
    });
  }

  if (!issuesOnly && photos > 0) {
    parts.push({
      key: 'photos',
      text: formatPart(photos, 'photo', 'photos'),
      className: 'metric-secondary',
    });
  }

  if (parts.length === 0) return null;

  return (
    <div className={`metric-line text-sm ${className}`.trim()}>
      {parts.map((part, index) => (
        <span key={part.key} className={part.className}>
          {index > 0 ? '· ' : ''}
          {part.text}
        </span>
      ))}
    </div>
  );
}
