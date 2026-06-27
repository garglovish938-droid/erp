import ast
import os
import sys

def get_imported_and_defined_names(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        tree = ast.parse(f.read(), filename=filepath)
    
    imported = set()
    defined = set()
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom):
            # We don't resolve '*' but we resolve explicit names
            for alias in node.names:
                imported.add(alias.asname or alias.name)
        elif isinstance(node, ast.ClassDef):
            defined.add(node.name)
        elif isinstance(node, ast.FunctionDef):
            defined.add(node.name)
            
    return imported, defined, tree

def get_all_referenced_names(tree):
    referenced = set()
    
    class NameVisitor(ast.NodeVisitor):
        def visit_Name(self, node):
            # We only check load contexts (usages, annotations, etc.)
            if isinstance(node.ctx, ast.Load):
                referenced.add(node.id)
            self.generic_visit(node)
            
        def visit_Attribute(self, node):
            # For attributes, we visit the value recursively (e.g. schemas.Something)
            self.generic_visit(node)
            
    visitor = NameVisitor()
    visitor.visit(tree)
    return referenced

def main():
    crud_path = 'backend/crud.py'
    if not os.path.exists(crud_path):
        print(f"Error: {crud_path} not found.")
        sys.exit(1)
        
    imported, defined, tree = get_imported_and_defined_names(crud_path)
    referenced = get_all_referenced_names(tree)
    
    # Python built-in names
    import builtins
    builtin_names = set(dir(builtins))
    
    # Other globally available modules in standard library imported or typical
    typical = {'Session', 'List', 'Optional', 'Dict', 'Any', 'Union', 'DateTime', 'Date', 'datetime', 'date', 'json', 'func', 're', 'time'}
    
    ignored = builtin_names | typical | {'db', 'self'}
    
    # Candidates that are referenced but not defined, imported, or standard built-in
    candidates = referenced - imported - defined - ignored
    
    # Filter candidates to only keep Capitalized names (classes, models, schemas)
    candidates = {name for name in candidates if name and name[0].isupper()}
    
    print("=== AST ANALYSIS FOR CRUD.PY (CAPITALIZED NAMES) ===")
    print(f"Total Imported Names: {len(imported)}")
    print(f"Total Defined Names: {len(defined)}")
    print(f"Total Referenced Names: {len(referenced)}")
    print(f"Potential Undefined/Unimported Capitalized Names: {candidates}")
    print("\nLet's check where these candidate names exist...")
    
    # Read models.py and schemas.py exports
    models_path = 'backend/models.py'
    schemas_path = 'backend/schemas.py'
    
    models_content = ""
    if os.path.exists(models_path):
        models_content = open(models_path, encoding='utf-8').read()
        
    schemas_content = ""
    if os.path.exists(schemas_path):
        schemas_content = open(schemas_path, encoding='utf-8').read()
        
    for name in sorted(list(candidates)):
        in_models = f"class {name}" in models_content or f"{name} =" in models_content
        in_schemas = f"class {name}" in schemas_content or f"{name} =" in schemas_content
        
        print(f"Name: {name}")
        print(f"  - In models.py: {in_models}")
        print(f"  - In schemas.py: {in_schemas}")
        
if __name__ == '__main__':
    main()
