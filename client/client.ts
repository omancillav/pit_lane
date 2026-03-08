import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import type { F1RaceResults } from "../target/types/f1_race_results";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.F1RaceResults as anchor.Program<F1RaceResults>;

async function runCRUD() {
  console.log("🏎️  Iniciando F1 Race Results...");

  const carreraKp = new web3.Keypair();
  console.log("📦 Dirección de la carrera:", carreraKp.publicKey.toBase58());

  // Datos del GP de México 2024 (resultado real)
  const clasificacionMexico = [
    "Carlos Sainz",
    "Charles Leclerc",
    "Lando Norris",
    "Oscar Piastri",
    "Max Verstappen",
    "Esteban Ocon",
    "Lance Stroll",
    "Nico Hulkenberg",
    "Yuki Tsunoda",
    "George Russell",
  ];
  const podioMexico = [clasificacionMexico[0], clasificacionMexico[1], clasificacionMexico[2]];

  try {
    // ── CREATE ────────────────────────────────────────────────────────────────
    console.log("\n🏁 Registrando GP de México 2024...");
    const txCreate = await program.methods
      .registrarCarrera(
        "Gran Premio de México",           // nombre_gp
        "Autódromo Hermanos Rodríguez",    // circuito
        2024,                              // temporada
        20,                                // numero_vuelta (carrera 20 de 24)
        71,                                // vueltas_totales
        podioMexico,                       // podio [ganador, 2do, 3ro]
        clasificacionMexico,                       // clasificacion
        "Max Verstappen",                  // vuelta_rapida_piloto
        "1:18.562",                        // vuelta_rapida_tiempo
        { seco: {} },                      // condicion: CondicionPista::Seco
        true,                              // hubo_safety_car
        false,                             // hubo_bandera_roja
      )
      .accounts({
        carrera: carreraKp.publicKey,
        usuario: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([carreraKp])
      .rpc();
    await program.provider.connection.confirmTransaction(txCreate);
    console.log("✅ Carrera registrada!");

    // ── READ ──────────────────────────────────────────────────────────────────
    let datos = await program.account.carrera.fetch(carreraKp.publicKey);
    console.log("\n📋 Resultado registrado:");
    console.log(`  GP           : ${datos.nombreGp} (${datos.temporada})`);
    console.log(`  Circuito     : ${datos.circuito}`);
    console.log(`  Vuelta N°    : ${datos.numeroVuelta}/24 — ${datos.vueltasTotales} vueltas`);
    console.log(`  Condición    : ${JSON.stringify(datos.condicion)}`);
    console.log(`  Safety Car   : ${datos.huboSafetyCar}`);
    console.log(`  Bandera Roja : ${datos.huboBanderaRoja}`);
    console.log("\n  🏆 Clasificación:");
    datos.clasificacion.forEach((piloto, i) => {
      const extra = datos.vueltaRapidaEnClasificacion && piloto === datos.vueltaRapidaPiloto ? " ⚡+1" : "";
      console.log(`    ${i + 1}. ${piloto} — ${datos.puntos[i]} pts${extra}`);
    });
    console.log(`\n  ⚡ Vuelta rápida: ${datos.vueltaRapidaPiloto} (${datos.vueltaRapidaTiempo})`);
    console.log(`     +1 punto aplicado: ${datos.vueltaRapidaEnClasificacion}`);

    // ── UPDATE ────────────────────────────────────────────────────────────────
    // Simulamos una corrección por descalificación de Leclerc
    console.log("\n🔄 Corrigiendo resultado (descalificación imaginaria de Leclerc)...");
    const clasificacionCorregido = [
      "Carlos Sainz",
      "Lando Norris",
      "Oscar Piastri",
      "Max Verstappen",
      "Esteban Ocon",
      "Lance Stroll",
      "Nico Hulkenberg",
      "Yuki Tsunoda",
      "George Russell",
      "Fernando Alonso",
    ];
    const txUpdate = await program.methods
      .actualizarResultado(
        [clasificacionCorregido[0], clasificacionCorregido[1], clasificacionCorregido[2]],
        clasificacionCorregido,
        "Max Verstappen",
        "1:18.562",
      )
      .accounts({
        carrera: carreraKp.publicKey,
        registrador: program.provider.publicKey,
      })
      .rpc();
    await program.provider.connection.confirmTransaction(txUpdate);
    console.log("✅ Resultado corregido!");

    datos = await program.account.carrera.fetch(carreraKp.publicKey);
    console.log("\n  🏆 Nueva clasificación:");
    datos.clasificacion.forEach((piloto, i) => {
      const extra = datos.vueltaRapidaEnClasificacion && piloto === datos.vueltaRapidaPiloto ? " ⚡+1" : "";
      console.log(`    ${i + 1}. ${piloto} — ${datos.puntos[i]} pts${extra}`);
    });

    // ── TOGGLE CANCELADA ──────────────────────────────────────────────────────
    console.log("\n🚫 Cancelando carrera...");
    const txToggle1 = await program.methods
      .toggleCancelada()
      .accounts({
        carrera: carreraKp.publicKey,
        registrador: program.provider.publicKey,
      })
      .rpc();
    await program.provider.connection.confirmTransaction(txToggle1);

    datos = await program.account.carrera.fetch(carreraKp.publicKey);
    console.log(`✅ Cancelada: ${datos.cancelada}`); // true

    console.log("\n✅ Reactivando carrera...");
    const txToggle2 = await program.methods
      .toggleCancelada()
      .accounts({
        carrera: carreraKp.publicKey,
        registrador: program.provider.publicKey,
      })
      .rpc();
    await program.provider.connection.confirmTransaction(txToggle2);

    datos = await program.account.carrera.fetch(carreraKp.publicKey);
    console.log(`✅ Cancelada: ${datos.cancelada}`); // false

    // ── DELETE ────────────────────────────────────────────────────────────────
    console.log("\n🗑️  Eliminando registro y recuperando SOL...");
    const txDelete = await program.methods
      .eliminarCarrera()
      .accounts({
        carrera: carreraKp.publicKey,
        registrador: program.provider.publicKey,
      })
      .rpc();
    await program.provider.connection.confirmTransaction(txDelete);
    console.log("✅ Carrera eliminada, SOL devuelto al registrador.");

    const cuentaCerrada = await program.provider.connection.getAccountInfo(carreraKp.publicKey);
    console.log("\n🔍 Cuenta cerrada:", cuentaCerrada === null ? "Sí ✅" : "No ❌");

  } catch (error) {
    console.error("❌ Error en la transacción:", error);
  }
}

runCRUD();