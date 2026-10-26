import ast


def calculate_ast_blast_radius(original_code: str, modified_code: str) -> dict:
    """AST Blast Radius & complexity delta calculations.

    Parses both the original and modified source, then computes the function
    set difference and total statement delta to detect scope creep.
    """
    try:
        tree_orig = ast.parse(original_code)
        tree_mod = ast.parse(modified_code)
    except SyntaxError as e:
        return {"error": f"Syntax Error in PR code: {e}"}

    orig_funcs = {
        node.name
        for node in ast.walk(tree_orig)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    mod_funcs = {
        node.name
        for node in ast.walk(tree_mod)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }

    orig_statements = sum(1 for node in ast.walk(tree_orig) if isinstance(node, ast.stmt))
    mod_statements = sum(1 for node in ast.walk(tree_mod) if isinstance(node, ast.stmt))
    delta_statements = abs(mod_statements - orig_statements)

    return {
        "original_functions": list(orig_funcs),
        "modified_functions": list(mod_funcs),
        "statement_delta": delta_statements,
        "scope_creep_detected": len(mod_funcs - orig_funcs) > 2,
    }
