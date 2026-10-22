import type { LegacyState, State } from './model';
export function migrateV1(input: LegacyState): State {
 return {...input, schemaVersion:2, growth:{points:0,days:{}},reminderHistory:{},preferences:{...input.preferences,movementMode:'bottom',cardHidden:false,reminders:{lunch:true,offwork:true,leadMinutes:5},accessory:'none'}};
}
