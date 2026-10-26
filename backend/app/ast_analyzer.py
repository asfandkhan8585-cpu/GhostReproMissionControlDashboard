import ast


def calculate_ast_blast_radius(original_code: str, modified_code: str) -> dict:
    """AST Blast Radius & complexity delta calculations.

    Parses both the original and modified source, then computes the function
    and class set differences and total statement delta to detect scope creep.
    Statements are strictly matched using isinstance(node, ast.stmt).
    Functions include both standard FunctionDef and AsyncFunctionDef.
    """
    try:
        tree_orig = ast.parse(original_code)
    except SyntaxError as e:
        return {"error": f"Syntax Error in original code: {e}"}

    try:
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

    orig_classes = {
        node.name
        for node in ast.walk(tree_orig)
        if isinstance(node, ast.ClassDef)
    }
    mod_classes = {
        node.name
        for node in ast.walk(tree_mod)
        if isinstance(node, ast.ClassDef)
    }

    orig_statements = sum(1 for node in ast.walk(tree_orig) if isinstance(node, ast.stmt))
    mod_statements = sum(1 for node in ast.walk(tree_mod) if isinstance(node, ast.stmt))
    delta_statements = abs(mod_statements - orig_statements)

    funcs_added = list(mod_funcs - orig_funcs)
    classes_added = list(mod_classes - orig_classes)

    return {
        "original_functions": list(orig_funcs),
        "modified_functions": list(mod_funcs),
        "functions_added": funcs_added,
        "classes_added": classes_added,
        "original_statements": orig_statements,
        "modified_statements": mod_statements,
        "statement_delta": delta_statements,
        "scope_creep_detected": len(funcs_added) > 2 or delta_statements > 50,
    }
