use anchor_lang::prelude::*;

declare_id!("Cu1rwKY5PXUu9N9YYVjZCyjV4R5TCMfKp759QTg3yeU4");

// ── CONSTANTES DE PUNTOS F1 ───────────────────────────────────────────────────
// Sistema oficial: posiciones 1-10 + 1 punto extra por vuelta rapida (si aplica)
const PUNTOS_F1: [u8; 10] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// ── ENUM: CONDICIÓN DE PISTA ──────────────────────────────────────────────────
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, PartialEq, Debug)]
pub enum CondicionPista {
    Seco,
    Mojado,
    Mixto,
}

#[program]
pub mod f1_race_results {
    use super::*;

    // ── CREATE ────────────────────────────────────────────────────────────────
    pub fn registrar_carrera(
        ctx: Context<RegistrarCarrera>,
        nombre_gp: String,
        circuito: String,
        temporada: u16,
        numero_vuelta: u8,               // carrera N° dentro del calendario (1–24)
        vueltas_totales: u8,             // vueltas totales de la carrera
        podio: [String; 3],              // [ganador, segundo, tercero]
        clasificacion: [String; 10],             // los 10 primeros clasificados
        vuelta_rapida_piloto: String,
        vuelta_rapida_tiempo: String,
        condicion: CondicionPista,
        hubo_safety_car: bool,
        hubo_bandera_roja: bool,
    ) -> Result<()> {
        // Validaciones básicas
        require!(!nombre_gp.is_empty(), ErroresF1::NombreVacio);
        require!(nombre_gp.len() <= 50, ErroresF1::NombreMuyLargo);
        require!(!circuito.is_empty(), ErroresF1::NombreVacio);
        require!(temporada >= 1950, ErroresF1::TemporadaInvalida);
        require!(numero_vuelta >= 1 && numero_vuelta <= 24, ErroresF1::NumeroVueltaInvalido);
        require!(vueltas_totales >= 1 && vueltas_totales <= 100, ErroresF1::VueltasInvalidas);
        require!(!podio[0].is_empty(), ErroresF1::PilotoVacio);

        // Validar que el podio no tenga pilotos repetidos
        require!(podio[0] != podio[1], ErroresF1::PilotoDuplicado);
        require!(podio[0] != podio[2], ErroresF1::PilotoDuplicado);
        require!(podio[1] != podio[2], ErroresF1::PilotoDuplicado);

        // Validar que no haya duplicados en la clasificacion
        for i in 0..10 {
            for j in (i + 1)..10 {
                if !clasificacion[i].is_empty() && !clasificacion[j].is_empty() {
                    require!(clasificacion[i] != clasificacion[j], ErroresF1::PilotoDuplicado);
                }
            }
        }

        // Validar que el podio coincida con las primeras 3 de la clasificacion
        require!(clasificacion[0] == podio[0], ErroresF1::PodioNoCoincide);
        require!(clasificacion[1] == podio[1], ErroresF1::PodioNoCoincide);
        require!(clasificacion[2] == podio[2], ErroresF1::PodioNoCoincide);

        // Determinar si el piloto de vuelta rapida aplica para el punto extra
        let vuelta_rapida_en_clasificacion = !vuelta_rapida_piloto.is_empty()
            && clasificacion.iter().any(|p| p == &vuelta_rapida_piloto);

        // Calcular puntos con posible punto extra por vuelta rápida
        let mut puntos: [u8; 10] = [0; 10];
        for i in 0..10 {
            puntos[i] = PUNTOS_F1[i];
            if vuelta_rapida_en_clasificacion && clasificacion[i] == vuelta_rapida_piloto {
                puntos[i] += 1;
            }
        }

        let carrera = &mut ctx.accounts.carrera;
        carrera.nombre_gp = nombre_gp;
        carrera.circuito = circuito;
        carrera.temporada = temporada;
        carrera.numero_vuelta = numero_vuelta;
        carrera.vueltas_totales = vueltas_totales;
        carrera.podio = podio;
        carrera.clasificacion = clasificacion;
        carrera.puntos = puntos;
        carrera.vuelta_rapida_piloto = vuelta_rapida_piloto;
        carrera.vuelta_rapida_tiempo = vuelta_rapida_tiempo;
        carrera.vuelta_rapida_en_clasificacion = vuelta_rapida_en_clasificacion;
        carrera.condicion = condicion;
        carrera.hubo_safety_car = hubo_safety_car;
        carrera.hubo_bandera_roja = hubo_bandera_roja;
        carrera.cancelada = false;
        carrera.registrador = *ctx.accounts.usuario.key;

        msg!("🏁 GP {} {} — Vuelta {}/24 — {} vueltas",
            carrera.nombre_gp, carrera.temporada,
            carrera.numero_vuelta, carrera.vueltas_totales);
        msg!("🥇 {} ({} pts) | 🥈 {} ({} pts) | 🥉 {} ({} pts)",
            carrera.podio[0], carrera.puntos[0],
            carrera.podio[1], carrera.puntos[1],
            carrera.podio[2], carrera.puntos[2]);
        msg!("⚡ Vuelta rápida: {} ({}) — +1 pto: {}",
            carrera.vuelta_rapida_piloto, carrera.vuelta_rapida_tiempo,
            carrera.vuelta_rapida_en_clasificacion);

        Ok(())
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    pub fn actualizar_resultado(
        ctx: Context<ModificarCarrera>,
        nuevo_podio: [String; 3],
        nuevo_clasificacion: [String; 10],
        nueva_vuelta_rapida_piloto: String,
        nueva_vuelta_rapida_tiempo: String,
    ) -> Result<()> {
        require!(!ctx.accounts.carrera.cancelada, ErroresF1::CarreraCancelada);
        require!(!nuevo_podio[0].is_empty(), ErroresF1::PilotoVacio);

        // Validar podio sin repetidos
        require!(nuevo_podio[0] != nuevo_podio[1], ErroresF1::PilotoDuplicado);
        require!(nuevo_podio[0] != nuevo_podio[2], ErroresF1::PilotoDuplicado);
        require!(nuevo_podio[1] != nuevo_podio[2], ErroresF1::PilotoDuplicado);

        // Validar clasificacion sin repetidos
        for i in 0..10 {
            for j in (i + 1)..10 {
                if !nuevo_clasificacion[i].is_empty() && !nuevo_clasificacion[j].is_empty() {
                    require!(nuevo_clasificacion[i] != nuevo_clasificacion[j], ErroresF1::PilotoDuplicado);
                }
            }
        }

        // Validar que podio coincida con clasificacion
        require!(nuevo_clasificacion[0] == nuevo_podio[0], ErroresF1::PodioNoCoincide);
        require!(nuevo_clasificacion[1] == nuevo_podio[1], ErroresF1::PodioNoCoincide);
        require!(nuevo_clasificacion[2] == nuevo_podio[2], ErroresF1::PodioNoCoincide);

        // Recalcular vuelta rápida y puntos
        let vuelta_rapida_en_clasificacion = !nueva_vuelta_rapida_piloto.is_empty()
            && nuevo_clasificacion.iter().any(|p| p == &nueva_vuelta_rapida_piloto);

        let mut puntos: [u8; 10] = [0; 10];
        for i in 0..10 {
            puntos[i] = PUNTOS_F1[i];
            if vuelta_rapida_en_clasificacion && nuevo_clasificacion[i] == nueva_vuelta_rapida_piloto {
                puntos[i] += 1;
            }
        }

        let carrera = &mut ctx.accounts.carrera;
        carrera.podio = nuevo_podio;
        carrera.clasificacion = nuevo_clasificacion;
        carrera.puntos = puntos;
        carrera.vuelta_rapida_piloto = nueva_vuelta_rapida_piloto;
        carrera.vuelta_rapida_tiempo = nueva_vuelta_rapida_tiempo;
        carrera.vuelta_rapida_en_clasificacion = vuelta_rapida_en_clasificacion;

        msg!("🔄 Resultado actualizado — GP {}", carrera.nombre_gp);
        msg!("🥇 {} ({} pts) | 🥈 {} ({} pts) | 🥉 {} ({} pts)",
            carrera.podio[0], carrera.puntos[0],
            carrera.podio[1], carrera.puntos[1],
            carrera.podio[2], carrera.puntos[2]);

        Ok(())
    }

    // ── TOGGLE CANCELADA ──────────────────────────────────────────────────────
    pub fn toggle_cancelada(ctx: Context<ModificarCarrera>) -> Result<()> {
        let carrera = &mut ctx.accounts.carrera;
        carrera.cancelada = !carrera.cancelada;

        if carrera.cancelada {
            msg!("🚫 GP {} marcado como cancelado.", carrera.nombre_gp);
        } else {
            msg!("✅ GP {} reactivado.", carrera.nombre_gp);
        }

        Ok(())
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    pub fn eliminar_carrera(_ctx: Context<EliminarCarrera>) -> Result<()> {
        // Anchor cierra la cuenta automáticamente con "close = registrador"
        Ok(())
    }
}

// ── ERRORES ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErroresF1 {
    #[msg("El nombre no puede estar vacío.")]
    NombreVacio,
    #[msg("El nombre excede los 50 caracteres.")]
    NombreMuyLargo,
    #[msg("El nombre del piloto no puede estar vacío.")]
    PilotoVacio,
    #[msg("La temporada debe ser 1950 o posterior.")]
    TemporadaInvalida,
    #[msg("El número de vuelta debe estar entre 1 y 24.")]
    NumeroVueltaInvalido,
    #[msg("El número de vueltas totales debe estar entre 1 y 100.")]
    VueltasInvalidas,
    #[msg("No puede haber pilotos repetidos en la clasificación.")]
    PilotoDuplicado,
    #[msg("El podio debe coincidir con las primeras 3 de la clasificacion.")]
    PodioNoCoincide,
    #[msg("No se puede modificar una carrera cancelada.")]
    CarreraCancelada,
}

// ── STRUCT ────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Carrera {
    #[max_len(50)]
    pub nombre_gp: String,
    #[max_len(50)]
    pub circuito: String,
    pub temporada: u16,
    pub numero_vuelta: u8,
    pub vueltas_totales: u8,

    // Clasificación
    #[max_len(10, 40)]
    pub clasificacion: [String; 10],
    #[max_len(3, 40)]
    pub podio: [String; 3],
    pub puntos: [u8; 10],

    // Vuelta rápida
    #[max_len(40)]
    pub vuelta_rapida_piloto: String,
    #[max_len(20)]
    pub vuelta_rapida_tiempo: String,
    pub vuelta_rapida_en_clasificacion: bool,

    // Condiciones de carrera
    pub condicion: CondicionPista,
    pub hubo_safety_car: bool,
    pub hubo_bandera_roja: bool,

    pub cancelada: bool,
    pub registrador: Pubkey,
}

// ── CONTEXTOS ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RegistrarCarrera<'info> {
    #[account(
        init,
        payer = usuario,
        space = Carrera::INIT_SPACE + 8
    )]
    pub carrera: Account<'info, Carrera>,
    #[account(mut)]
    pub usuario: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModificarCarrera<'info> {
    #[account(mut, has_one = registrador)]
    pub carrera: Account<'info, Carrera>,
    pub registrador: Signer<'info>,
}

#[derive(Accounts)]
pub struct EliminarCarrera<'info> {
    #[account(
        mut,
        has_one = registrador,
        close = registrador
    )]
    pub carrera: Account<'info, Carrera>,
    #[account(mut)]
    pub registrador: Signer<'info>,
}