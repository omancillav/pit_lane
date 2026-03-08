import * as anchor from "@coral-xyz/anchor";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import type { F1RaceResults } from "../target/types/f1_race_results";

describe("f1_race_results", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.F1RaceResults as anchor.Program<F1RaceResults>;
  
  const carreraKp = new web3.Keypair();

  // Datos base reutilizados en varios tests
  const clasificacionBase = [
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
  const podioBase = [clasificacionBase[0], clasificacionBase[1], clasificacionBase[2]];

  // ── CREATE ────────────────────────────────────────────────────────────────
  it("Registra una carrera con todos los datos correctamente", async () => {
    const txHash = await program.methods
      .registrarCarrera(
        "Gran Premio de México",
        "Autódromo Hermanos Rodríguez",
        2024,
        20,
        71,
        podioBase,
        clasificacionBase,
        "Max Verstappen",    // vuelta rápida — está en posición 5 del clasificacion
        "1:18.562",
        { seco: {} },
        true,
        false,
      )
      .accounts({
        carrera: carreraKp.publicKey,
        usuario: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([carreraKp])
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const c = await program.account.carrera.fetch(carreraKp.publicKey);
    assert.equal(c.nombreGp, "Gran Premio de México");
    assert.equal(c.circuito, "Autódromo Hermanos Rodríguez");
    assert.equal(c.temporada, 2024);
    assert.equal(c.numeroVuelta, 20);
    assert.equal(c.vueltasTotales, 71);
    assert.equal(c.podio[0], "Carlos Sainz");
    assert.equal(c.podio[1], "Charles Leclerc");
    assert.equal(c.podio[2], "Lando Norris");
    // Puntos: ganador=25, 2do=18, 3ro=15
    assert.equal(c.puntos[0], 25);
    assert.equal(c.puntos[1], 18);
    assert.equal(c.puntos[2], 15);
    // Verstappen está en posición 5 (índice 4) → 10 pts + 1 extra = 11
    assert.equal(c.vueltaRapidaEnClasificacion, true);
    assert.equal(c.puntos[4], 11);
    assert.equal(c.huboSafetyCar, true);
    assert.equal(c.huboBanderaRoja, false);
    assert.equal(c.cancelada, false);
    assert.equal(c.registrador.toBase58(), program.provider.publicKey.toBase58());
  });

  
  it("No asigna punto extra si la vuelta rapida no aplica", async () => {
    const otraKp = new web3.Keypair();
    const txHash = await program.methods
      .registrarCarrera(
        "Gran Premio de Brasil",
        "Autódromo José Carlos Pace",
        2024,
        21,
        71,
        podioBase,
        clasificacionBase,
        "Fernando Alonso",  // no está en el clasificacionBase → sin punto extra
        "1:12.345",
        { mojado: {} },
        false,
        true,
      )
      .accounts({
        carrera: otraKp.publicKey,
        usuario: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([otraKp])
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const c = await program.account.carrera.fetch(otraKp.publicKey);
    assert.equal(c.vueltaRapidaEnClasificacion, false);
    // Todos los puntos deben ser los estándar sin extra
    assert.equal(c.puntos[0], 25);
    assert.equal(c.puntos[4], 10); // sin +1

    // Limpiar
    await program.methods
      .eliminarCarrera()
      .accounts({ carrera: otraKp.publicKey, registrador: program.provider.publicKey })
      .rpc();
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  it("Actualiza el resultado y recalcula puntos correctamente", async () => {
    const clasificacionNueva = [
      "Carlos Sainz",
      "Lando Norris",        // Leclerc descalificado
      "Oscar Piastri",
      "Max Verstappen",
      "Esteban Ocon",
      "Lance Stroll",
      "Nico Hulkenberg",
      "Yuki Tsunoda",
      "George Russell",
      "Fernando Alonso",
    ];
    const txHash = await program.methods
      .actualizarResultado(
        [clasificacionNueva[0], clasificacionNueva[1], clasificacionNueva[2]],
        clasificacionNueva,
        "Max Verstappen",  // vuelta rápida ahora en posición 4 (índice 3)
        "1:18.562",
      )
      .accounts({
        carrera: carreraKp.publicKey,
        registrador: program.provider.publicKey,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const c = await program.account.carrera.fetch(carreraKp.publicKey);
    assert.equal(c.podio[0], "Carlos Sainz");
    assert.equal(c.podio[1], "Lando Norris");
    assert.equal(c.podio[2], "Oscar Piastri");
    // Verstappen ahora en índice 3 → 12 pts + 1 = 13
    assert.equal(c.vueltaRapidaEnClasificacion, true);
    assert.equal(c.puntos[3], 13);
  });

  // ── TOGGLE ────────────────────────────────────────────────────────────────
  it("Toggle cancela y reactiva la carrera", async () => {
    const txCancelar = await program.methods
      .toggleCancelada()
      .accounts({ carrera: carreraKp.publicKey, registrador: program.provider.publicKey })
      .rpc();
    await program.provider.connection.confirmTransaction(txCancelar);

    let c = await program.account.carrera.fetch(carreraKp.publicKey);
    assert.equal(c.cancelada, true);

    const txReactivar = await program.methods
      .toggleCancelada()
      .accounts({ carrera: carreraKp.publicKey, registrador: program.provider.publicKey })
      .rpc();
    await program.provider.connection.confirmTransaction(txReactivar);

    c = await program.account.carrera.fetch(carreraKp.publicKey);
    assert.equal(c.cancelada, false);
  });

  // ── VALIDACIONES ──────────────────────────────────────────────────────────
  it("Falla si el nombre del GP está vacío", async () => {
    const kp = new web3.Keypair();
    try {
      await program.methods
        .registrarCarrera("", "Circuito", 2024, 1, 50, podioBase, clasificacionBase, "", "", { seco: {} }, false, false)
        .accounts({ carrera: kp.publicKey, usuario: program.provider.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([kp])
        .rpc();
      assert.fail("Debió fallar");
    } catch (err) {
      assert.ok(err.message.includes("NombreVacio"));
    }
  });

  it("Falla si hay pilotos duplicados en la clasificacion", async () => {
    const kp = new web3.Keypair();
    const clasificacionDuplicada = [...clasificacionBase];
    clasificacionDuplicada[5] = "Carlos Sainz"; // duplicado con posición 1
    try {
      await program.methods
        .registrarCarrera("GP Test", "Circuito", 2024, 1, 50, podioBase, clasificacionDuplicada, "", "", { seco: {} }, false, false)
        .accounts({ carrera: kp.publicKey, usuario: program.provider.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([kp])
        .rpc();
      assert.fail("Debió fallar");
    } catch (err) {
      assert.ok(err.message.includes("PilotoDuplicado"));
    }
  });

  it("Falla si el podio no coincide con la clasificacion", async () => {
    const kp = new web3.Keypair();
    const podioMal = ["Max Verstappen", "Charles Leclerc", "Lando Norris"]; // ganador no coincide con clasificacion[0]
    try {
      await program.methods
        .registrarCarrera("GP Test", "Circuito", 2024, 1, 50, podioMal, clasificacionBase, "", "", { seco: {} }, false, false)
        .accounts({ carrera: kp.publicKey, usuario: program.provider.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([kp])
        .rpc();
      assert.fail("Debió fallar");
    } catch (err) {
      assert.ok(err.message.includes("PodioNoCoincide"));
    }
  });

  it("Falla al actualizar una carrera cancelada", async () => {
    // Cancelar
    const txCancelar = await program.methods
      .toggleCancelada()
      .accounts({ carrera: carreraKp.publicKey, registrador: program.provider.publicKey })
      .rpc();
    await program.provider.connection.confirmTransaction(txCancelar);

    try {
      await program.methods
        .actualizarResultado(podioBase, clasificacionBase, "", "")
        .accounts({ carrera: carreraKp.publicKey, registrador: program.provider.publicKey })
        .rpc();
      assert.fail("Debió fallar");
    } catch (err) {
      assert.ok(err.message.includes("CarreraCancelada"));
    }

    // Reactivar para el siguiente test
    const txReactivar = await program.methods
      .toggleCancelada()
      .accounts({ carrera: carreraKp.publicKey, registrador: program.provider.publicKey })
      .rpc();
    await program.provider.connection.confirmTransaction(txReactivar);
  });

  it("Falla con temporada inválida (antes de 1950)", async () => {
    const kp = new web3.Keypair();
    try {
      await program.methods
        .registrarCarrera("GP Test", "Circuito", 1900, 1, 50, podioBase, clasificacionBase, "", "", { seco: {} }, false, false)
        .accounts({ carrera: kp.publicKey, usuario: program.provider.publicKey, systemProgram: web3.SystemProgram.programId })
        .signers([kp])
        .rpc();
      assert.fail("Debió fallar");
    } catch (err) {
      assert.ok(err.message.includes("TemporadaInvalida"));
    }
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  it("Elimina la carrera y cierra la cuenta", async () => {
    const txHash = await program.methods
      .eliminarCarrera()
      .accounts({
        carrera: carreraKp.publicKey,
        registrador: program.provider.publicKey,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const cuentaCerrada = await program.provider.connection.getAccountInfo(carreraKp.publicKey);
    assert.equal(cuentaCerrada, null);
  });
});