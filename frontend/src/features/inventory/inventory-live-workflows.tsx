"use client";

import { useEffect, useState, type FormEvent } from "react";
import { APIRequestError } from "@/lib/api-client";
import {
  confirmConsumption, createRecipe, listPreparations, listRecipes, savePreparation, traceBatch, tracePatient,
  updateRecipe, type BotanicalItem, type Preparation, type Recipe, type RecipeInput, type StockBatch, type TraceRow,
} from "./api";
import styles from "./inventory-workspace.module.css";

const emptyRecipe: RecipeInput = { code: "", displayName: "", baseYieldGrams: "", ingredients: [{ itemId: "", quantityGrams: "" }] };

function message(error: unknown) {
  if (error instanceof APIRequestError) {
    if (error.status === 409) return "The record, allocation, or stock changed. Refresh before another action.";
    if (error.status === 422) return "Check the recipe, exact grams, patient/session link, and batch allocation totals.";
    if (error.status === 401) return "Your session ended. Sign in again.";
    if (error.status === 403 || error.status === 404) return "This record is unavailable to your account.";
  }
  return "The service could not confirm the action. Keep the same operation ID and check the preparation before retrying.";
}

export default function InventoryLiveWorkflows({ tab, items, batches, refreshBatches }: {
  tab: "recipes" | "consumption" | "traceability"; items: BotanicalItem[]; batches: StockBatch[];
  refreshBatches: () => Promise<unknown>;
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeForm, setRecipeForm] = useState<RecipeInput>(emptyRecipe);
  const [editingRecipe, setEditingRecipe] = useState("");
  const [patientID, setPatientID] = useState("");
  const [sessionID, setSessionID] = useState("");
  const [recipeID, setRecipeID] = useState("");
  const [yieldGrams, setYieldGrams] = useState("");
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [selectedPreparation, setSelectedPreparation] = useState<Preparation | null>(null);
  const [allocations, setAllocations] = useState<{ batchId: string; quantityGrams: string }[]>([{ batchId: "", quantityGrams: "" }]);
  const [operationID, setOperationID] = useState("");
  const [traceType, setTraceType] = useState<"batch" | "patient">("batch");
  const [traceID, setTraceID] = useState("");
  const [traceRows, setTraceRows] = useState<TraceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (tab !== "recipes") return;
    let mounted = true;
    listRecipes().then(result => { if (mounted) setRecipes(result.items ?? []); }, error => {
      if (mounted) { setIsError(true); setNotice(message(error)); }
    });
    return () => { mounted = false; };
  }, [tab]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setNotice("");
    try { await action(); setIsError(false); setNotice(success); }
    catch (error) { setIsError(true); setNotice(message(error)); }
    finally { setBusy(false); }
  }

  function chooseRecipe(id: string) {
    setEditingRecipe(id);
    const recipe = recipes.find(item => item.id === id);
    setRecipeForm(recipe ? { code: recipe.code, displayName: recipe.displayName, baseYieldGrams: recipe.baseYieldGrams,
      ingredients: recipe.ingredients.map(item => ({ itemId: item.itemId, quantityGrams: item.quantityGrams })), version: recipe.version } : emptyRecipe);
  }

  function submitRecipe(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const recipe = editingRecipe ? await updateRecipe(editingRecipe, recipeForm) : await createRecipe(recipeForm);
      const result = await listRecipes();
      setRecipes(result.items ?? []); chooseRecipe(""); setRecipeID(recipe.id);
    }, editingRecipe ? "Recipe updated. Existing saved snapshots remain unchanged." : "Flat recipe created.");
  }

  function loadPatient(event: FormEvent) {
    event.preventDefault();
    setPreparations([]);
    setSelectedPreparation(null);
    void run(async () => { const result = await listPreparations(patientID.trim()); setPreparations(result.items ?? []); setSelectedPreparation(null); }, "Patient preparations loaded.");
  }

  function submitPreparation(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await savePreparation({ patientId: patientID.trim(), sessionId: sessionID.trim(), recipeId: recipeID, targetYieldGrams: yieldGrams.trim() });
      setSelectedPreparation(created); setPreparations(previous => [created, ...previous]);
      setOperationID(crypto.randomUUID()); setAllocations([{ batchId: "", quantityGrams: "" }]);
    }, "Preparation saved. No stock was reserved or deducted.");
  }

  function choosePreparation(id: string) {
    const item = preparations.find(value => value.id === id) ?? null;
    setSelectedPreparation(item); setOperationID(item?.operationId ?? crypto.randomUUID());
    setAllocations([{ batchId: "", quantityGrams: "" }]); setNotice("");
  }

  function submitConsumption(event: FormEvent) {
    event.preventDefault();
    if (!selectedPreparation || selectedPreparation.status !== "prepared") return;
    void run(async () => {
      const confirmed = await confirmConsumption(selectedPreparation.id, { operationId: operationID, allocations });
      setSelectedPreparation(confirmed);
      setPreparations(previous => previous.map(item => item.id === confirmed.id ? confirmed : item));
      await refreshBatches();
    }, "Consumption confirmed. Stock and traceability were updated together.");
  }

  function submitTrace(event: FormEvent) {
    event.preventDefault();
    setTraceRows([]);
    void run(async () => { const result = traceType === "batch" ? await traceBatch(traceID.trim()) : await tracePatient(traceID.trim()); setTraceRows(result.items ?? []); }, "Confirmed consumption history loaded.");
  }

  return <div className={styles.splitGrid}>
    {notice && <p role={isError ? "alert" : "status"} className={isError ? styles.calloutError : styles.calloutInfo}>{notice}</p>}
    {tab === "recipes" && <>
      <section className={styles.panel} aria-labelledby="live-recipe-title"><h2 id="live-recipe-title" className={styles.panelTitle}>Flat botanical recipes</h2>
        <p className={styles.hint}>Each ingredient links directly to an active botanical item. Saved preparation snapshots keep their original recipe quantities.</p>
        <label className={styles.label} htmlFor="live-recipe-select">Edit an existing recipe</label>
        <select id="live-recipe-select" className={styles.select} value={editingRecipe} onChange={event => chooseRecipe(event.target.value)}><option value="">New recipe</option>{recipes.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.code} · {recipe.displayName}</option>)}</select>
        <form onSubmit={submitRecipe}>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="recipe-code-live">Recipe code</label><input id="recipe-code-live" className={styles.input} value={recipeForm.code} disabled={Boolean(editingRecipe)} onChange={event => setRecipeForm({ ...recipeForm, code: event.target.value })} required /></div>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="recipe-name-live">Display name</label><input id="recipe-name-live" className={styles.input} value={recipeForm.displayName} onChange={event => setRecipeForm({ ...recipeForm, displayName: event.target.value })} required /></div>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="recipe-yield-live">Base yield · grams</label><input id="recipe-yield-live" className={styles.input} inputMode="decimal" value={recipeForm.baseYieldGrams} onChange={event => setRecipeForm({ ...recipeForm, baseYieldGrams: event.target.value })} required /></div>
          {recipeForm.ingredients.map((ingredient, index) => <div key={index} className={styles.fieldGroup}><label className={styles.label} htmlFor={`ingredient-${index}`}>Ingredient {index + 1}</label><select id={`ingredient-${index}`} className={styles.select} value={ingredient.itemId} required onChange={event => setRecipeForm({ ...recipeForm, ingredients: recipeForm.ingredients.map((item, i) => i === index ? { ...item, itemId: event.target.value } : item) })}><option value="">Choose botanical item</option>{items.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.code} · {item.displayName}</option>)}</select><label className={styles.label} htmlFor={`ingredient-grams-${index}`}>Base quantity · grams</label><input id={`ingredient-grams-${index}`} className={styles.input} inputMode="decimal" value={ingredient.quantityGrams} onChange={event => setRecipeForm({ ...recipeForm, ingredients: recipeForm.ingredients.map((item, i) => i === index ? { ...item, quantityGrams: event.target.value } : item) })} required /></div>)}
          <div className={styles.actions}><button type="button" className={styles.secondaryBtn} onClick={() => setRecipeForm({ ...recipeForm, ingredients: [...recipeForm.ingredients, { itemId: "", quantityGrams: "" }] })}>Add ingredient</button><button className={styles.primaryBtn} disabled={busy}>{editingRecipe ? "Save recipe version" : "Create recipe"}</button></div>
        </form>
      </section>
      <section className={styles.panel} aria-labelledby="save-preparation-title"><h2 id="save-preparation-title" className={styles.panelTitle}>Save a preparation snapshot</h2><p className={styles.hint}>Saving records the scaled recipe for one patient session. It never deducts or reserves stock.</p>
        <form onSubmit={submitPreparation}>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="prep-patient">Patient ID</label><input id="prep-patient" className={styles.input} value={patientID} onChange={event => setPatientID(event.target.value)} required /></div>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="prep-session">Session ID</label><input id="prep-session" className={styles.input} value={sessionID} onChange={event => setSessionID(event.target.value)} required /></div>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="prep-recipe">Recipe</label><select id="prep-recipe" className={styles.select} value={recipeID} onChange={event => setRecipeID(event.target.value)} required><option value="">Choose recipe</option>{recipes.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.code} · {recipe.displayName}</option>)}</select></div>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="prep-yield">Target yield · grams</label><input id="prep-yield" className={styles.input} inputMode="decimal" value={yieldGrams} onChange={event => setYieldGrams(event.target.value)} required /></div>
          <button className={styles.primaryBtn} disabled={busy}>Save immutable snapshot</button>
        </form>
      </section>
    </>}
    {tab === "consumption" && <>
      <section className={styles.panel} aria-labelledby="patient-preparations-title"><h2 id="patient-preparations-title" className={styles.panelTitle}>Patient preparations</h2>
        <form onSubmit={loadPatient}><div className={styles.fieldGroup}><label className={styles.label} htmlFor="find-preparation-patient">Patient ID</label><input id="find-preparation-patient" className={styles.input} value={patientID} onChange={event => setPatientID(event.target.value)} required /></div><button className={styles.secondaryBtn} disabled={busy}>Load preparations</button></form>
        <label className={styles.label} htmlFor="live-preparation-select">Preparation</label><select id="live-preparation-select" className={styles.select} value={selectedPreparation?.id ?? ""} onChange={event => choosePreparation(event.target.value)}><option value="">Choose saved preparation</option>{preparations.map(item => <option key={item.id} value={item.id}>{item.id} · {item.status}</option>)}</select>
        {selectedPreparation && <><p className={styles.hint}>Status: <strong>{selectedPreparation.status}</strong> · Recipe version {selectedPreparation.recipeVersion} · Target {selectedPreparation.targetYieldGrams} g</p>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Snapshot ingredient</th><th>Required</th></tr></thead><tbody>{selectedPreparation.snapshot.map(item => <tr key={item.itemId}><td>{item.itemDisplayName}</td><td>{item.requiredGrams} g</td></tr>)}</tbody></table></div>
          {selectedPreparation.status === "consumed" && <p role="status" className={styles.calloutInfo}>Confirmed consumption is immutable. {selectedPreparation.consumptions.length} batch allocation(s) recorded.</p>}</>}
      </section>
      <section className={styles.panel} aria-labelledby="confirm-consumption-title"><h2 id="confirm-consumption-title" className={styles.panelTitle}>Manual batch allocation</h2><p className={styles.hint}>Choose eligible batches. Quantities for each ingredient must exactly equal its saved snapshot requirement. Keep the operation ID for a safe retry.</p>
        {selectedPreparation?.status === "prepared" ? <form onSubmit={submitConsumption}>
          <div className={styles.fieldGroup}><label className={styles.label} htmlFor="consumption-operation">Operation ID</label><input id="consumption-operation" className={styles.input} value={operationID} readOnly /></div>
          {allocations.map((allocation, index) => <div className={styles.fieldGroup} key={index}><label className={styles.label} htmlFor={`allocation-batch-${index}`}>Eligible batch {index + 1}</label><select id={`allocation-batch-${index}`} className={styles.select} value={allocation.batchId} required onChange={event => setAllocations(allocations.map((item, i) => i === index ? { ...item, batchId: event.target.value } : item))}><option value="">Choose batch</option>{batches.filter(batch => batch.eligibility === "eligible").map(batch => <option key={batch.id} value={batch.id}>{batch.batchReference} · {batch.itemDisplayName} · {batch.remainingGrams} g</option>)}</select><label className={styles.label} htmlFor={`allocation-grams-${index}`}>Quantity · grams</label><input id={`allocation-grams-${index}`} className={styles.input} inputMode="decimal" value={allocation.quantityGrams} required onChange={event => setAllocations(allocations.map((item, i) => i === index ? { ...item, quantityGrams: event.target.value } : item))} /></div>)}
          <div className={styles.actions}><button type="button" className={styles.secondaryBtn} onClick={() => setAllocations([...allocations, { batchId: "", quantityGrams: "" }])}>Add batch</button><button className={styles.primaryBtn} disabled={busy}>Confirm actual consumption</button></div>
        </form> : <p className={styles.hint}>Select a prepared record to confirm consumption.</p>}
      </section>
    </>}
    {tab === "traceability" && <section className={styles.panel} aria-labelledby="live-trace-title"><h2 id="live-trace-title" className={styles.panelTitle}>Confirmed batch traceability</h2><p className={styles.hint}>Only actual confirmed consumption appears here. Prepared snapshots are excluded.</p>
      <form onSubmit={submitTrace}><div className={styles.fieldGroup}><label className={styles.label} htmlFor="trace-type">Trace direction</label><select id="trace-type" className={styles.select} value={traceType} onChange={event => { setTraceType(event.target.value as "batch" | "patient"); setTraceRows([]); }}><option value="batch">Batch → patients</option><option value="patient">Patient → batches</option></select></div>
        <div className={styles.fieldGroup}><label className={styles.label} htmlFor="trace-record">{traceType === "batch" ? "Batch ID" : "Patient ID"}</label><input id="trace-record" className={styles.input} value={traceID} onChange={event => setTraceID(event.target.value)} required /></div><button className={styles.primaryBtn} disabled={busy}>Trace confirmed use</button></form>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Patient</th><th>Batch</th><th>Actual quantity</th><th>Session</th><th>Confirmed</th></tr></thead><tbody>{traceRows.map((row, index) => <tr key={`${row.preparationId}-${row.batchId}-${index}`}><td>{row.patientDisplayName}<div className={styles.hint}>{row.patientId}</div></td><td>{row.batchReference}</td><td>{row.quantityGrams} g</td><td>{row.sessionId}</td><td>{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.confirmedAt))}</td></tr>)}</tbody></table>{traceRows.length === 0 && <p role="status" className={styles.hint}>No confirmed consumption is loaded.</p>}</div>
    </section>}
  </div>;
}
