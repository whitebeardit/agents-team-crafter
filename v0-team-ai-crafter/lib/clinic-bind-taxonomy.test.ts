import test from "node:test"
import assert from "node:assert/strict"
import {
  bindPreviewHasClinicGoldSignal,
  classifyBusinessActionId,
  classifyPackIdForClinicLayer,
  classifyToolDefinitionLayer,
  isClinicalOperationalBriefing,
} from "@/lib/clinic-bind-taxonomy"
import type { TeamPlanBindPreview } from "@/lib/types"

test("classifyBusinessActionId: clinic_* is clinic_gold", () => {
  assert.equal(classifyBusinessActionId("clinic_schedule_session_by_phone"), "clinic_gold")
})

test("classifyBusinessActionId: crm_* is universal_primitive", () => {
  assert.equal(classifyBusinessActionId("crm_create_lead"), "universal_primitive")
})

test("classifyPackIdForClinicLayer: clinic_ops", () => {
  assert.equal(classifyPackIdForClinicLayer("clinic_ops"), "clinic_ops_layer")
})

test("classifyPackIdForClinicLayer: universal pack", () => {
  assert.equal(classifyPackIdForClinicLayer("scheduling"), "universal_layer")
})

test("classifyToolDefinitionLayer: pack clinic_ops elevates to recommended", () => {
  assert.equal(
    classifyToolDefinitionLayer({ actionId: "some_custom_id", packIds: ["clinic_ops"] }),
    "recommended",
  )
})

test("isClinicalOperationalBriefing matches clinical + operational text", () => {
  assert.equal(
    isClinicalOperationalBriefing({
      problemSummary: "Clínica",
      operationKinds: ["atendimento"],
    } as Parameters<typeof isClinicalOperationalBriefing>[0]),
    true,
  )
  assert.equal(isClinicalOperationalBriefing({ problemSummary: "Clínica" }), true) // no op kinds = still true
})

test("bindPreviewHasClinicGoldSignal detects clinic_ in toolDefinitions", () => {
  const preview: TeamPlanBindPreview = {
    autoBindEnabled: true,
    effectiveBindEnabled: true,
    autoBindMode: "inherit",
    autoBindPolicySource: "environment_default",
    reusedAgentBindMode: "manual",
    autoBindActionsRequested: 0,
    autoBindActionsApplied: 0,
    autoBindActionsTruncated: false,
    bindOverridesApplied: false,
    bindOverrideAgentCount: 0,
    bindOverrideActionCount: 0,
    requiresExplicitApproval: false,
    toolDefinitions: [
      {
        actionId: "clinic_create_patient",
        slug: "x",
        packIds: ["clinic_ops"],
        currentStatus: "missing",
        plannedOperation: "create",
      },
    ],
    suggestedPacks: [],
    diffSummary: { affectedAgentCount: 0, addedActionCount: 0, removedActionCount: 0 },
    agents: [],
  }
  assert.equal(bindPreviewHasClinicGoldSignal(preview), true)
})
