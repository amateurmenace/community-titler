import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'ico', ...props,
});

export const IPlay = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>;
export const IStop = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /></svg>;
export const IPlus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IUpload = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>;
export const IDownload = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>;
export const IFolder = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
export const ITrash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const ICopy = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>;
export const IUp = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
export const IDown = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12l7 7 7-7" /></svg>;
export const IChevron = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>;
export const ICheck = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12l5 5L20 7" /></svg>;
export const IArrowRight = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
export const IMore = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>;
export const IClose = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const ISparkle = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg>;
export const IFile = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
export const IRefresh = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></svg>;
export const IHelp = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></svg>;
export const IHome = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></svg>;

/** The app mark: a tile and two bars — a lower third, reduced. */
export const Mark = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="9" width="7" height="9" rx="1.6" fill="#052e16" />
    <rect x="10.5" y="9" width="11.5" height="5" rx="1.2" fill="#052e16" />
    <rect x="10.5" y="15.5" width="8" height="2.5" rx="0.9" fill="#052e16" />
    <path d="M3.6 13.2a1.9 1.9 0 0 1 3.8 0" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
