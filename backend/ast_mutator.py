"""
AST Mutation Engine for CodeDuel.
Procedurally injects logical bugs into clean Python programs using ast.NodeTransformer.
Supports:
  - Comparison Operator Flip (< -> <=, == -> !=, etc.)
  - Arithmetic Mutation (+ -> -, * -> /, etc.)
  - Off-by-One Range Shift (range(1, n+1) -> range(1, n), range(n) -> range(n-1), etc.)
  - Inverted Conditions (if cond -> if not cond, and <-> or)
"""

import ast
import random
import difflib
from typing import Dict, Any, List, Optional, Tuple


class ComparisonFlipper(ast.NodeTransformer):
    """Flips comparison operators (e.g. < to >=, == to !=)."""
    OP_MAP = {
        ast.Lt: [ast.LtE, ast.Gt, ast.GtE],
        ast.LtE: [ast.Lt, ast.GtE, ast.Gt],
        ast.Gt: [ast.GtE, ast.Lt, ast.LtE],
        ast.GtE: [ast.Gt, ast.LtE, ast.Lt],
        ast.Eq: [ast.NotEq],
        ast.NotEq: [ast.Eq],
        ast.In: [ast.NotIn],
        ast.NotIn: [ast.In],
    }

    def __init__(self, target_site: Optional[int] = None):
        self.target_site = target_site
        self.current_site = 0
        self.mutation_info = None

    def visit_Compare(self, node: ast.Compare) -> ast.AST:
        self.generic_visit(node)
        new_ops = []
        mutated_here = False

        for op in node.ops:
            op_type = type(op)
            if op_type in self.OP_MAP:
                if self.target_site is None or self.current_site == self.target_site:
                    replacement_type = random.choice(self.OP_MAP[op_type])
                    new_op = replacement_type()
                    new_ops.append(new_op)
                    if not mutated_here and self.mutation_info is None:
                        self.mutation_info = {
                            "category": "comparison",
                            "original_op": op_type.__name__,
                            "new_op": replacement_type.__name__,
                            "lineno": getattr(node, "lineno", 1),
                            "description": f"Inverted comparison operator ({op_type.__name__} -> {replacement_type.__name__}) at line {getattr(node, 'lineno', 1)}"
                        }
                        mutated_here = True
                else:
                    new_ops.append(op)
                self.current_site += 1
            else:
                new_ops.append(op)

        node.ops = new_ops
        return node


class ArithmeticMutator(ast.NodeTransformer):
    """Mutates binary arithmetic operators (e.g. + to -, * to //)."""
    OP_MAP = {
        ast.Add: [ast.Sub, ast.Mult],
        ast.Sub: [ast.Add, ast.Mult],
        ast.Mult: [ast.Add, ast.FloorDiv],
        ast.FloorDiv: [ast.Mult, ast.Add],
        ast.Mod: [ast.FloorDiv, ast.Add]
    }

    def __init__(self, target_site: Optional[int] = None):
        self.target_site = target_site
        self.current_site = 0
        self.mutation_info = None

    def visit_BinOp(self, node: ast.BinOp) -> ast.AST:
        self.generic_visit(node)
        op_type = type(node.op)
        if op_type in self.OP_MAP:
            if self.target_site is None or self.current_site == self.target_site:
                if self.mutation_info is None:
                    replacement_type = random.choice(self.OP_MAP[op_type])
                    node.op = replacement_type()
                    self.mutation_info = {
                        "category": "arithmetic",
                        "original_op": op_type.__name__,
                        "new_op": replacement_type.__name__,
                        "lineno": getattr(node, "lineno", 1),
                        "description": f"Mutated arithmetic operator ({op_type.__name__} -> {replacement_type.__name__}) at line {getattr(node, 'lineno', 1)}"
                    }
            self.current_site += 1
        return node


class OffByOneMutator(ast.NodeTransformer):
    """
    Introduces off-by-one errors in range() calls, indexing/slicing, or loop upper bounds.
    E.g. range(len(x)) -> range(len(x) - 1)
         range(1, n + 1) -> range(1, n)
         range(start, stop) stop arg shifted by +-1
    """
    def __init__(self, target_site: Optional[int] = None):
        self.target_site = target_site
        self.current_site = 0
        self.mutation_info = None

    def visit_Call(self, node: ast.Call) -> ast.AST:
        self.generic_visit(node)
        # Check if call is range(...)
        if isinstance(node.func, ast.Name) and node.func.id == "range" and node.args:
            if self.target_site is None or self.current_site == self.target_site:
                if self.mutation_info is None:
                    target_arg_idx = len(node.args) - 1 if len(node.args) == 1 else 1
                    target_arg = node.args[target_arg_idx]

                    # If target is binop like (n + 1), strip the + 1 to make it n (classic off by one)
                    if isinstance(target_arg, ast.BinOp) and isinstance(target_arg.op, ast.Add) and isinstance(target_arg.right, ast.Constant) and target_arg.right.value == 1:
                        node.args[target_arg_idx] = target_arg.left
                        desc = f"Off-by-one error: removed + 1 from range() bound at line {getattr(node, 'lineno', 1)}"
                    else:
                        # Otherwise subtract 1 from upper bound: bound - 1
                        node.args[target_arg_idx] = ast.BinOp(
                            left=target_arg,
                            op=ast.Sub(),
                            right=ast.Constant(value=1)
                        )
                        desc = f"Off-by-one error: reduced range() upper bound by 1 at line {getattr(node, 'lineno', 1)}"

                    ast.copy_location(node.args[target_arg_idx], target_arg)
                    self.mutation_info = {
                        "category": "off_by_one",
                        "lineno": getattr(node, "lineno", 1),
                        "description": desc
                    }
            self.current_site += 1
        return node


class ConditionInverter(ast.NodeTransformer):
    """
    Inverts if conditions (e.g. if cond -> if not cond)
    or swaps logical operators (and <-> or).
    """
    def __init__(self, target_site: Optional[int] = None):
        self.target_site = target_site
        self.current_site = 0
        self.mutation_info = None

    def visit_If(self, node: ast.If) -> ast.AST:
        self.generic_visit(node)
        if self.target_site is None or self.current_site == self.target_site:
            if self.mutation_info is None:
                # Wrap test in UnaryOp Not if not already Not
                if isinstance(node.test, ast.UnaryOp) and isinstance(node.test.op, ast.Not):
                    node.test = node.test.operand
                    desc = f"Inverted boolean condition (removed 'not') at line {getattr(node, 'lineno', 1)}"
                else:
                    node.test = ast.UnaryOp(op=ast.Not(), operand=node.test)
                    desc = f"Inverted if condition with 'not' at line {getattr(node, 'lineno', 1)}"

                self.mutation_info = {
                    "category": "inverted_condition",
                    "lineno": getattr(node, "lineno", 1),
                    "description": desc
                }
        self.current_site += 1
        return node


MUTATOR_CLASSES = {
    "comparison": ComparisonFlipper,
    "arithmetic": ArithmeticMutator,
    "off_by_one": OffByOneMutator,
    "inverted_condition": ConditionInverter,
}


def count_sites(tree: ast.AST, mutator_cls) -> int:
    """Counts eligible mutation sites for a given transformer."""
    counter = mutator_cls(target_site=None)
    # create a deep copy or walk
    import copy
    counter.visit(copy.deepcopy(tree))
    return counter.current_site


def generate_diff(original: str, mutated: str) -> str:
    """Produces a unified diff string highlighting the bug injected."""
    orig_lines = original.splitlines(keepends=True)
    mut_lines = mutated.splitlines(keepends=True)
    diff = difflib.unified_diff(
        orig_lines,
        mut_lines,
        fromfile="clean_solution.py",
        tofile="buggy_code.py",
        n=2
    )
    return "".join(diff)


def mutate_code(clean_code: str, preferred_category: Optional[str] = None) -> Dict[str, Any]:
    """
    Mutates clean Python code by injecting a procedural bug.
    Args:
        clean_code: Syntactically valid Python code
        preferred_category: Optional category ('comparison', 'arithmetic', 'off_by_one', 'inverted_condition')
    Returns:
        Dict with keys:
          - buggy_code: str
          - mutation_category: str
          - description: str
          - lineno: int
          - diff: str
    """
    clean_tree = ast.parse(clean_code)

    categories = list(MUTATOR_CLASSES.keys())
    if preferred_category and preferred_category in MUTATOR_CLASSES:
        # Prioritize preferred category first
        categories.remove(preferred_category)
        categories.insert(0, preferred_category)
    else:
        random.shuffle(categories)

    for cat in categories:
        mutator_cls = MUTATOR_CLASSES[cat]
        sites = count_sites(clean_tree, mutator_cls)
        if sites > 0:
            chosen_site = random.randint(0, sites - 1)
            transformer = mutator_cls(target_site=chosen_site)
            # Fresh copy
            import copy
            mutated_tree = transformer.visit(copy.deepcopy(clean_tree))
            ast.fix_missing_locations(mutated_tree)

            try:
                buggy_code = ast.unparse(mutated_tree)
                # Ensure it compiles and is different
                ast.parse(buggy_code)
                if buggy_code.strip() != clean_code.strip() and transformer.mutation_info:
                    diff = generate_diff(clean_code, buggy_code)
                    return {
                        "buggy_code": buggy_code,
                        "mutation_category": transformer.mutation_info["category"],
                        "description": transformer.mutation_info["description"],
                        "lineno": transformer.mutation_info["lineno"],
                        "diff": diff
                    }
            except Exception:
                continue

    # Fallback: if no AST transformer caught a site, apply simple deterministic mutation
    if "<=" in clean_code:
        buggy_code = clean_code.replace("<=", "<", 1)
        desc = "Inverted comparison operator '<=' to '<'"
        cat = "comparison"
    elif "==" in clean_code:
        buggy_code = clean_code.replace("==", "!=", 1)
        desc = "Inverted comparison operator '==' to '!='"
        cat = "comparison"
    elif "+" in clean_code:
        buggy_code = clean_code.replace("+", "-", 1)
        desc = "Mutated arithmetic '+' to '-'"
        cat = "arithmetic"
    else:
        buggy_code = clean_code + "\n    # Bug: Unreachable or wrong return\n"
        desc = "Procedural logic modification"
        cat = "logic"

    return {
        "buggy_code": buggy_code,
        "mutation_category": cat,
        "description": desc,
        "lineno": 1,
        "diff": generate_diff(clean_code, buggy_code)
    }


if __name__ == "__main__":
    import json
    import os
    problems_path = os.path.join(os.path.dirname(__file__), "problems.json")
    with open(problems_path, "r") as f:
        problems = json.load(f)

    print(f"Loaded {len(problems)} problems. Testing AST mutator...")
    for p in problems:
        res = mutate_code(p["clean_code"])
        print(f"[{p['id']}] Category: {res['mutation_category']} | Desc: {res['description']}")
        assert res["buggy_code"] != p["clean_code"]
        assert len(res["diff"]) > 0
    print("All AST mutation tests passed successfully!")
