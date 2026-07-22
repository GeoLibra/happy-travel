/**
 * Showroom Vehicle Role Profile Module
 * Identifies component roles for F1 car meshes and enforces runtime wheel spin node allowlist per AGENTS.md contract.
 */

export type VehicleComponentRole =
  | 'body'
  | 'wheel'
  | 'tyre'
  | 'wing'
  | 'floor'
  | 'halo'
  | 'suspension'
  | 'brake'
  | 'unknown';

export const RUNTIME_WHEEL_SPIN_NODES = [
  'WheelSpin_FL',
  'WheelSpin_FR',
  'WheelSpin_RL',
  'WheelSpin_RR',
] as const;

export function isRuntimeWheelSpinNode(name: string): boolean {
  return RUNTIME_WHEEL_SPIN_NODES.includes(name as typeof RUNTIME_WHEEL_SPIN_NODES[number]);
}

/**
 * Identifies the structural role of a vehicle mesh/node based on strict name contracts.
 */
export function identifyVehicleRole(name: string): VehicleComponentRole {
  if (!name) return 'unknown';

  const cleanName = name.trim();

  // Strict runtime wheel spin check
  if (isRuntimeWheelSpinNode(cleanName)) {
    return 'wheel';
  }

  const lower = cleanName.toLowerCase();

  if (lower.includes('tyre') || lower.includes('tire')) {
    return 'tyre';
  }
  if (lower.includes('wheel') || lower.includes('rim')) {
    return 'wheel';
  }
  if (lower.includes('wing') || lower.includes('spoiler') || cleanName.includes('RearHardRockAeroPanel')) {
    return 'wing';
  }
  if (lower.includes('floor') || lower.includes('underbody') || lower.includes('diffuser')) {
    return 'floor';
  }
  if (lower.includes('halo')) {
    return 'halo';
  }
  if (lower.includes('suspension') || lower.includes('wishbone') || lower.includes('damper')) {
    return 'suspension';
  }
  if (lower.includes('brake') || lower.includes('caliper') || lower.includes('disc')) {
    return 'brake';
  }
  if (
    lower.includes('body') ||
    lower.includes('chassis') ||
    lower.includes('monocoque') ||
    lower.includes('sidepod') ||
    lower.includes('nose') ||
    lower.includes('cover')
  ) {
    return 'body';
  }

  return 'unknown';
}
