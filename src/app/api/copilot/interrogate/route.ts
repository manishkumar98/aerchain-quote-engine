import { NextResponse } from 'next/server';
import { parseCopilotQuery } from '@/lib/copilot/intentParser';
import { deterministicSolver } from '@/lib/copilot/deterministicSolver';

/**
 * POST /api/copilot/interrogate
 *
 * Interrogation endpoint implementing the strict two-layer decoupling:
 * 1. Layer 1: Natural Language Intent Parsing into parameterized AST (zero arithmetic in tokens).
 * 2. Layer 2: Deterministic solver execution in pure SQL/TypeScript.
 * 3. Layer 3: Narrative summary, structured metrics, line allocations, and highlight coordinates.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body.query;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Missing or empty query parameter.' },
        { status: 400 }
      );
    }

    // Layer 1: Intent Parsing (AST Generation)
    const queryAst = await parseCopilotQuery(query);

    // Layer 2: Deterministic Optimization Solver
    const solverResult = deterministicSolver.execute(
      queryAst.intent,
      queryAst.constraints
    );

    // Layer 3: Response Payload
    return NextResponse.json({
      success: true,
      query_ast: queryAst,
      summary_markdown: solverResult.summary_markdown,
      scenario_metrics: solverResult.scenario_metrics,
      line_allocations: solverResult.line_allocations || [],
      highlight_cells: solverResult.highlight_cells,
      fx_sensitivity_details: solverResult.fx_sensitivity_details,
    });
  } catch (err: any) {
    console.error('Error executing copilot interrogation:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error in copilot interrogation engine' },
      { status: 500 }
    );
  }
}
