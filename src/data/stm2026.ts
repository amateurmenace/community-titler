// Brookline Special Town Meeting — November 17, 2026.
// Warrant article numbers and titles as posted on brooklinema.gov
// ("Current Town Meeting Files"). Loaded as the first-run sample project;
// also available as public/samples/brookline-stm-2026-warrant-articles.csv.
import { newId, type TitleItem } from '../types';

export const STM_TAG = 'Brookline Special Town Meeting · November 2026';

const ARTICLES: Array<[number, string]> = [
  [1, 'Approval of unpaid bills of a prior fiscal year (Select Board)'],
  [2, 'Approval of Collective Bargaining Agreements (Human Resources)'],
  [3, 'FY27 Budget Amendment (Select Board)'],
  [4, 'FY27 Budget Amendment reducing the reserve fund and adding funding to the Claims and Settlements Fund for the reimbursement of legal fees (Gordon, TMM1, Friedman, TMM12)'],
  [5, 'Resolution urging the Select Board to reimburse the legal fees of TMM Respondents (Anderson, Bassett, TMM6)'],
  [6, 'Amend Section 2.1.11 of the Town’s General By-laws by adding a Subsection H preventing legislative action by Town Meeting members from being the foundation of any investigation or complaint initiated by the Town (Lescohier, TMM11)'],
  [7, 'Create a new Section 8.XX of the General By-Laws banning cryptocurrency kiosks (Shapiro, Fischer, TMM11)'],
  [8, 'Create a new Section 3.XX of the General By-Laws banning public meetings on election day (Kahn, TMM15)'],
  [9, 'Petition for a special act modifying the administrative requirements applicable to the Transportation Board and authorizing the Town to raise parking fines beyond $50 (Select Board)'],
  [10, 'Amend Section 6.02 of the Zoning By-Law to eliminate residential parking minimums in the Transit Parking Overlay District (TPOD) (Wachter, Wholey, TMM11, Sheinin, TMM6, Wheeler, TMM3)'],
  [11, 'Authorization for the acquisition of certain temporary and permanent easements on Kennard Road related to the construction of the William H. Lincoln Safe Routes to School Project (Department of Public Works)'],
  [12, 'Create a new Section 8.XX of the General By-Laws regarding outdoor lighting (Moderator’s Committee for Exterior Lighting)'],
  [13, 'Amend Section 7.06 of the Zoning By-Law to set standards for the illumination of exterior lighting (Moderator’s Committee for Exterior Lighting)'],
  [14, 'Amend Section 4.08 of the Zoning By-Law to allow Cash in Lieu of Units Inclusionary Zoning Payments in certain developments in the Harvard Street Main Street corridor districts (Blood)'],
  [15, 'Amend the Zoning By-Law to establish a new Pleasant Street Multifamily Overlay District (Allen)'],
  [16, 'Authorize the Select Board to enter into a Memorandum of Agreement related to the development of 26 Pleasant Street (Select Board)'],
  [17, 'Resolution regarding CPA funding and the Affordable Housing Trust (Blood)'],
  [18, 'Resolution urging the Select Board to revise their Free Cash policy related to the Affordable Housing Trust (Brown)'],
  [19, 'Resolution regarding a new Commonwealth of Massachusetts seal and flag (MacKenzie)'],
  [20, 'Resolution regarding support of Vision Zero (Dempsey)'],
  [21, 'Reports of Town Officers and Committees. (Select Board)'],
];

export function stm2026Items(): TitleItem[] {
  const items: TitleItem[] = [
    {
      id: newId(),
      type: 'show',
      badge: '',
      primary: 'Brookline Special Town Meeting 2026',
      secondary: '', // blank → theme identity line (station · url)
    },
  ];
  for (const [n, title] of ARTICLES) {
    items.push({ id: newId(), type: 'article', badge: `Article ${n}`, primary: title, secondary: STM_TAG });
  }
  return items;
}
