const SOURCE_LABELS: Record<string, string> = {
  austender: 'AusTender',
  tendersnet: 'Tenders.Net',
  qld_tenders: 'QLD Tenders',
  nsw_etender: 'NSW eTender',
  vic_tenders: 'VIC Tenders',
  wa_tenders: 'WA Tenders',
  sa_tenders: 'SA Tenders',
  tas_tenders: 'TAS Tenders',
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  austender: 'Federal procurement feed',
  tendersnet: 'Commercial tender aggregation',
  qld_tenders: 'Queensland government tenders',
  nsw_etender: 'NSW eTendering feed',
  vic_tenders: 'Victorian government tenders',
  wa_tenders: 'Western Australian government tenders',
  sa_tenders: 'South Australian government tenders',
};

export function getSourceLabel(sourceName: string): string {
  if (SOURCE_LABELS[sourceName]) return SOURCE_LABELS[sourceName];
  const spaced = sourceName.replace(/_/g, ' ');
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getSourceDescription(sourceName: string): string {
  return SOURCE_DESCRIPTIONS[sourceName] ?? 'Connected tender source';
}
