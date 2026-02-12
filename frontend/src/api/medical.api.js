import {
  diagnosisOptions,
  symptomOptions,
  specialConditionOptions,
  chemicalDrugOptions,
  herbsOptions
} from "../data/medicalOptions";

export async function getDiagnosisOptions() {
  return diagnosisOptions;
}

export async function getSymptomOptions() {
  return symptomOptions;
}

export async function getSpecialConditionOptions() {
  return specialConditionOptions;
}

export async function getChemicalDrugOptions() {
  return chemicalDrugOptions;
}

export async function getHerbsOptions() {
  return herbsOptions;
}
