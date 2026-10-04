/** Treatment answer options, exactly as the Stay, Transfer and Discharge models were trained on them. */
export const INVESTIGATION_OPTIONS = ['x-ray', 'ct scan', 'mri scan', 'ultrasound scan', 'others'];
export const PRIMARY_MANAGEMENT_OPTIONS = [
  'wound suturing', 'fracture stabilization', 'wound cleaning and dressing', 'wound debridement',
  'only medicine and discharge', 'informed to jmo / police', 'observation for head injury',
  'ligamental injury management', 'reduction done for left elbow joint dislocation', 'surgery',
  'duration of hospital stay', 'others',
];
export const SECONDARY_MANAGEMENT_OPTIONS = [
  'no other management', ...PRIMARY_MANAGEMENT_OPTIONS.filter((o) => o !== 'others' && o !== 'duration of hospital stay'),
  'imaging', 'pain management', 'pop applied', 'strict bed rest', 'x ray (right hand)', 'others',
];
