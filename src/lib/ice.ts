export type IcePath = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown';

export type IcePair = {
  local: IcePath;
  remote: IcePath;
};

export type IceReport = {
  connectionState: string;
  gatheringState: string;
  local: IcePath[];
  remote: IcePath[];
  selected: IcePair | null;
};

export type IceStat = {
  type: string;
  id?: string;
  state?: string;
  nominated?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: string;
};

const KNOWN: IcePath[] = ['host', 'srflx', 'prflx', 'relay'];

export const emptyIceReport = (): IceReport => ({
  connectionState: 'new',
  gatheringState: 'new',
  local: [],
  remote: [],
  selected: null,
});

export const asIcePath = (value?: string): IcePath => {
  for (const path of KNOWN) {
    if (path === value) return path;
  }
  return 'unknown';
};

export const classifyCandidate = (candidate: string): IcePath => {
  const match = / typ ([a-z]+)/.exec(candidate);
  return asIcePath(match?.[1]);
};

export const addUniquePath = (paths: IcePath[], path: IcePath): IcePath[] => {
  if (path === 'unknown') return paths;
  for (const existing of paths) {
    if (existing === path) return paths;
  }
  return [...paths, path];
};

export const pathsFromSdp = (sdp: string): IcePath[] => {
  let paths: IcePath[] = [];
  const lines = sdp.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('a=candidate:')) continue;
    paths = addUniquePath(paths, classifyCandidate(line));
  }
  return paths;
};

export const pairFromStats = (stats: Iterable<IceStat>): IcePair | null => {
  const byId = new Map<string, IceStat>();
  const pairs: IceStat[] = [];
  for (const stat of stats) {
    if (stat.id) byId.set(stat.id, stat);
    if (stat.type === 'candidate-pair') pairs.push(stat);
  }
  let chosen: IceStat | null = null;
  for (const pair of pairs) {
    if (pair.nominated || pair.state === 'succeeded') chosen = pair;
    if (pair.nominated && pair.state === 'succeeded') break;
  }
  if (!chosen) return null;
  const local = byId.get(chosen.localCandidateId ?? '');
  const remote = byId.get(chosen.remoteCandidateId ?? '');
  return {
    local: asIcePath(local?.candidateType),
    remote: asIcePath(remote?.candidateType),
  };
};

export const formatIceReport = (report: IceReport): string => {
  if (report.selected) {
    return (
      `ICE ${report.selected.local} → ${report.selected.remote}` +
      ` · ${report.connectionState}`
    );
  }
  const local = report.local.length > 0 ? report.local.join('/') : '—';
  const remote = report.remote.length > 0 ? report.remote.join('/') : '—';
  return `ICE local ${local} · remote ${remote} · ${report.connectionState}`;
};
