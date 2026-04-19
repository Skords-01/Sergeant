import { PantryManagerSheet } from "./PantryManagerSheet.jsx";
import { ConfirmDeleteSheet } from "./ConfirmDeleteSheet.jsx";
import { ItemEditSheet } from "./ItemEditSheet.jsx";
import { BarcodeScanner } from "./BarcodeScanner.jsx";
import { AddMealSheet } from "./AddMealSheet.jsx";
import { InputDialog } from "@shared/components/ui/InputDialog";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";

export function NutritionOverlays({
  pantry,
  log,
  busy,
  pantryScannerOpen,
  setPantryScannerOpen,
  handlePantryBarcodeDetected,
  editingMeal,
  setEditingMeal,
  wrappedSaveMeal,
  prefs,
  setPrefs,
  backupPasswordDialog,
  setBackupPasswordDialog,
  handleBackupPasswordConfirm,
  restoreConfirm,
  setRestoreConfirm,
  applyRestorePayload,
}) {
  return (
    <>
      <PantryManagerSheet
        open={pantry.pantryManagerOpen}
        onClose={() => pantry.setPantryManagerOpen(false)}
        pantries={pantry.pantries}
        activePantryId={pantry.activePantryId}
        setActivePantryId={pantry.setActivePantryId}
        pantryForm={pantry.pantryForm}
        setPantryForm={pantry.setPantryForm}
        busy={busy}
        onSavePantryForm={pantry.onSavePantryForm}
        onBeginCreate={pantry.beginCreatePantry}
        onBeginRename={pantry.beginRenamePantry}
        onBeginDelete={pantry.beginDeletePantry}
      />

      <ConfirmDeleteSheet
        open={pantry.confirmDeleteOpen}
        onClose={() => pantry.setConfirmDeleteOpen(false)}
        pantries={pantry.pantries}
        activePantryId={pantry.activePantryId}
        onConfirm={pantry.onConfirmDeletePantry}
      />

      <ItemEditSheet
        itemEdit={pantry.itemEdit}
        setItemEdit={pantry.setItemEdit}
        onClose={() => pantry.setItemEdit((s) => ({ ...s, open: false }))}
        onSave={pantry.onSaveItemEdit}
      />

      {pantryScannerOpen && (
        <BarcodeScanner
          onDetected={handlePantryBarcodeDetected}
          onClose={() => setPantryScannerOpen(false)}
        />
      )}

      <AddMealSheet
        open={log.addMealSheetOpen}
        onClose={() => {
          log.setAddMealSheetOpen(false);
          log.setAddMealPhotoResult(null);
          setEditingMeal(null);
        }}
        onSave={wrappedSaveMeal}
        photoResult={log.addMealPhotoResult}
        initialMeal={editingMeal}
        mealTemplates={prefs.mealTemplates || []}
        setPrefs={setPrefs}
        pantryItems={pantry.effectiveItems}
        onConsumePantryItem={pantry.consumePantryItem}
      />

      <InputDialog
        open={!!backupPasswordDialog}
        title={backupPasswordDialog?.title || ""}
        description={backupPasswordDialog?.description || ""}
        type="password"
        placeholder="Пароль"
        onConfirm={handleBackupPasswordConfirm}
        onCancel={() => setBackupPasswordDialog(null)}
      />

      <ConfirmDialog
        open={!!restoreConfirm}
        title="Відновити бекап?"
        description="Це перезапише поточні дані харчування на цьому пристрої."
        confirmLabel="Відновити"
        danger
        onConfirm={() => {
          applyRestorePayload(restoreConfirm?.payload);
          setRestoreConfirm(null);
        }}
        onCancel={() => setRestoreConfirm(null)}
      />
    </>
  );
}
