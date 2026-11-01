package clinical

// MemberBPathway is the one sequence supplied in DEC02-AYURFLOW-CLINIC-RULES-REV1.0.
// Formal clinic sign-off evidence remains a separate acceptance gate.
func MemberBPathway() []StageDefinition {
	return []StageDefinition{
		{Label: "PREPARATORY", RequiredChecks: []string{
			"Initial consultation signed", "Pre-treatment vitals and contraindications recorded", "Attending clinician approval",
		}},
		{Label: "PRIMARY", RequiredChecks: []string{
			"All scheduled primary therapy sessions completed", "Botanical preparations confirmed or accounted for", "Attending clinician interim evaluation approval",
		}},
		{Label: "RECOVERY", RequiredChecks: []string{
			"Recovery therapy sessions delivered", "Discharge clinical assessment signed", "Final review recorded by assigned clinician",
		}},
	}
}

var stageCodes = []string{"PREPARATORY", "PRIMARY", "RECOVERY"}
