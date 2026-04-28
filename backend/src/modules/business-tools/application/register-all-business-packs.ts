import type { BusinessToolRegistry } from './business-tool-registry.js';
import { registerCrmPack } from '../../crm/application/register-crm-pack.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import { registerCarePack } from '../../care/application/register-care-pack.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';
import { registerServicesSalesPack } from '../../services-sales/application/register-services-sales-pack.js';
import type { ServiceCatalogRepository } from '../../services-sales/infra/service-catalog.repository.js';
import type { ServiceOrderRepository } from '../../services-sales/infra/service-order.repository.js';
import { registerPackagesEncountersPack } from '../../packages-encounters/application/register-packages-encounters-pack.js';
import type { PackageSaleRepository } from '../../packages-encounters/infra/package-sale.repository.js';
import type { EncounterRepository } from '../../packages-encounters/infra/encounter.repository.js';
import type { PackageConsumptionRepository } from '../../packages-encounters/infra/package-consumption.repository.js';
import { ClinicalRepository } from '../../clinical/infra/clinical.repository.js';
import { registerClinicalPack } from '../../clinical/application/register-clinical-pack.js';
import { registerFinancePack } from '../../finance/application/register-finance-pack.js';
import type { FinanceRepository } from '../../finance/infra/finance.repository.js';
import { registerReminderPack } from '../../reminders/application/register-reminder-pack.js';
import type { ReminderRepository } from '../../reminders/infra/reminder.repository.js';
import { registerGithubOpsPack } from '../../github-ops/application/register-github-ops-pack.js';
import { registerSchedulingPack } from '../../scheduling/application/register-scheduling-pack.js';
import type { AppointmentRepository } from '../../scheduling/infra/appointment.repository.js';
import type { AvailabilitySlotRepository } from '../../scheduling/infra/availability-slot.repository.js';
import type { WorkspaceRepository } from '../../workspaces/infra/workspace.repository.js';
import { registerClinicPack } from '../../clinic/application/register-clinic-pack.js';
import type { ClinicConversationStateRepository } from '../../clinic/infra/clinic-conversation-state.repository.js';

export function registerAllBusinessPacks(deps: {
  registry: BusinessToolRegistry;
  partyRepo: PartyRepository;
  careSubjectRepo: CareSubjectRepository;
  serviceCatalogRepo: ServiceCatalogRepository;
  serviceOrderRepo: ServiceOrderRepository;
  packageSaleRepo: PackageSaleRepository;
  encounterRepo: EncounterRepository;
  packageConsumptionRepo: PackageConsumptionRepository;
  financeRepo: FinanceRepository;
  reminderRepo: ReminderRepository;
  appointmentRepo: AppointmentRepository;
  availabilitySlotRepo: AvailabilitySlotRepository;
  workspaceRepo: WorkspaceRepository;
  clinicConversationStateRepo: ClinicConversationStateRepository;
}): void {
  registerCrmPack(deps.registry, deps.partyRepo);
  registerCarePack(deps.registry, deps.careSubjectRepo, deps.partyRepo);
  registerServicesSalesPack(deps.registry, deps.serviceCatalogRepo, deps.serviceOrderRepo);
  registerPackagesEncountersPack(
    deps.registry,
    deps.packageSaleRepo,
    deps.encounterRepo,
    deps.partyRepo,
    deps.careSubjectRepo,
    deps.packageConsumptionRepo,
  );
  const clinicalRepo = new ClinicalRepository(deps.partyRepo);
  registerClinicalPack(deps.registry, clinicalRepo, deps.partyRepo);
  registerFinancePack(deps.registry, deps.financeRepo, deps.partyRepo);
  registerReminderPack(deps.registry, deps.reminderRepo);
  registerGithubOpsPack(deps.registry);
  registerSchedulingPack(
    deps.registry,
    deps.appointmentRepo,
    deps.availabilitySlotRepo,
    deps.partyRepo,
    deps.careSubjectRepo,
    deps.serviceOrderRepo,
    deps.packageSaleRepo,
    deps.reminderRepo,
    deps.encounterRepo,
  );
  registerClinicPack({
    registry: deps.registry,
    parties: deps.partyRepo,
    careSubjects: deps.careSubjectRepo,
    workspaces: deps.workspaceRepo,
    packageSales: deps.packageSaleRepo,
    appointments: deps.appointmentRepo,
    conversationState: deps.clinicConversationStateRepo,
  });
}
