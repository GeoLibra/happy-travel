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

  // 1. Strict runtime wheel spin check
  if (isRuntimeWheelSpinNode(cleanName)) {
    return 'wheel';
  }

  const lower = cleanName.toLowerCase();

  // 2. Tyre / Tire check
  if (lower.includes('tyre') || lower.includes('tire')) {
    return 'tyre';
  }

  // 3. Wing / Aero panels (including RearHardRockAeroPanel and WheelArchAeroPanel)
  if (
    lower.includes('wing') ||
    lower.includes('spoiler') ||
    lower.includes('aeropanel') ||
    cleanName.includes('RearHardRockAeroPanel')
  ) {
    return 'wing';
  }

  // 4. Check for wheel-adjacent / arch / bodywork / extra modifiers
  const isWheelModifier =
    lower.includes('arch') ||
    lower.includes('adjacent') ||
    lower.includes('bodywork') ||
    lower.includes('deflector') ||
    lower.includes('housing') ||
    lower.includes('duct') ||
    lower.includes('extra');

  if (isWheelModifier) {
    if (lower.includes('body') || lower.includes('chassis') || lower.includes('adjacent')) {
      return 'body';
    }
    if (lower.includes('aero') || lower.includes('panel')) {
      return 'wing';
    }
    return 'body';
  }

  // 5. Standalone Wheel / Rim
  if (
    lower.includes('rim') ||
    cleanName === 'Wheel' ||
    cleanName === 'Wheels' ||
    cleanName.startsWith('Wheel_') ||
    cleanName.startsWith('Rim_')
  ) {
    return 'wheel';
  }

  // 6. Floor / Underbody / Diffuser
  if (lower.includes('floor') || lower.includes('underbody') || lower.includes('diffuser')) {
    return 'floor';
  }

  // 7. Halo
  if (lower.includes('halo')) {
    return 'halo';
  }

  // 8. Suspension
  if (lower.includes('suspension') || lower.includes('wishbone') || lower.includes('damper')) {
    return 'suspension';
  }

  // 9. Brake
  if (lower.includes('brake') || lower.includes('caliper') || lower.includes('disc')) {
    return 'brake';
  }

  // 10. Body / Chassis / Monocoque / Sidepod / Nose / Cover
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
