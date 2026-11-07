// Reads the documentation of a source file's exports from its TSDoc comments, with the
// TypeScript parser (syntax only, no type checking). The registry site turns the result into
// each item's API reference. Exports marked `@internal` are left out.
//
// Every export gives: name, kind, summary (Markdown), signature, and where they apply
// params (functions), members (props of interfaces, object types and classes), extends,
// examples, throws, returns and deprecated.

import ts from 'typescript';

/**
 * @typedef {object} DocTag
 * @property {string} tag Tag name without `@`, for example `example`.
 * @property {string} text The tag's text (may span lines).
 */

/**
 * @typedef {object} DocMember
 * @property {string} name
 * @property {string} type
 * @property {boolean} optional
 * @property {string} [defaultValue]
 * @property {string} description Markdown.
 * @property {boolean} [deprecated]
 */

/**
 * @typedef {object} ExportDoc
 * @property {string} name
 * @property {'component' | 'hook' | 'function' | 'constant' | 'class' | 'interface' | 'type' | 'enum'} kind
 * @property {string} summary Markdown.
 * @property {string} signature
 * @property {DocMember[]} [params]
 * @property {string} [returns] Return type.
 * @property {string} [returnsDescription] Markdown from `@returns`.
 * @property {DocMember[]} [members]
 * @property {string[]} [extends]
 * @property {string[]} examples Markdown (usually a fenced code block).
 * @property {string[]} throws Markdown.
 * @property {string} [deprecated] Markdown; set when the export is deprecated.
 * @property {string} [propsType] For components: the type of the props parameter.
 * @property {Record<string, string>} [propDefaults] For components: defaults from the props destructuring.
 */

/**
 * Splits a raw `/** ... *\/` comment into its summary and tags. Tags inside fenced code blocks
 * are left alone.
 *
 * @param {string} raw
 * @returns {{ summary: string; tags: DocTag[] }}
 */
export function parseDocComment(raw) {
  const body = raw
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .replace(/\r/g, '');
  const lines = body.split('\n').map((line) => line.replace(/^\s*\*? ?/, ''));
  const summary = [];
  /** @type {DocTag[]} */
  const tags = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const tag = inFence ? null : line.match(/^@(\w+)\s?(.*)$/);
    if (tag) tags.push({ tag: tag[1], text: tag[2] });
    else if (tags.length > 0) tags[tags.length - 1].text += `\n${line}`;
    else summary.push(line);
  }
  for (const tag of tags) tag.text = tag.text.trim();
  return { summary: summary.join('\n').trim(), tags };
}

/** The `/** ... *\/` comment right above a node, parsed. Empty when there is none. */
function leadingDoc(node, sourceFile) {
  const text = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  const docs = ranges.filter((range) => text.startsWith('/**', range.pos));
  if (docs.length === 0) return { summary: '', tags: [] };
  const last = docs[docs.length - 1];
  return parseDocComment(text.slice(last.pos, last.end));
}

/** Source text of a node with whitespace collapsed. */
function textOf(node, sourceFile) {
  return node ? node.getText(sourceFile).replace(/\s+/g, ' ').trim() : '';
}

const tagsNamed = (doc, name) => doc.tags.filter((tag) => tag.tag === name).map((tag) => tag.text);
const hasTag = (doc, name) => doc.tags.some((tag) => tag.tag === name);

/** `@example` text as Markdown: wrapped in a tsx fence unless it already has one. */
function exampleMarkdown(text) {
  return text.includes('```') ? text : `\`\`\`tsx\n${text}\n\`\`\``;
}

/**
 * The default value of a documented member: `@default` / `@defaultValue`, else a
 * "Default `x`" phrase in the description.
 */
export function defaultFromDoc(doc) {
  const tag = doc.tags.find((item) => item.tag === 'default' || item.tag === 'defaultValue');
  if (tag) return tag.text.replace(/^`|`$/g, '').trim() || undefined;
  const match = doc.summary.match(/\bdefault(?: is)?:?\s+(`[^`]+`|'[^']*'|"[^"]*"|-?\d[\d.]*\b)/i);
  return match ? match[1].replace(/^`|`$/g, '') : undefined;
}

/** Props or fields of an interface or object type. */
function membersOf(members, sourceFile) {
  /** @type {DocMember[]} */
  const result = [];
  for (const member of members) {
    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
    const doc = leadingDoc(member, sourceFile);
    if (hasTag(doc, 'internal')) continue;
    const type = ts.isMethodSignature(member)
      ? `(${member.parameters.map((p) => textOf(p, sourceFile)).join(', ')}) => ${textOf(member.type, sourceFile) || 'void'}`
      : textOf(member.type, sourceFile) || 'unknown';
    result.push({
      name: textOf(member.name, sourceFile),
      type,
      optional: Boolean(member.questionToken),
      defaultValue: defaultFromDoc(doc),
      description: doc.summary,
      ...(hasTag(doc, 'deprecated') ? { deprecated: true } : {}),
    });
  }
  return result;
}

/** Public properties of a class (not private, protected or `#private`). */
function classMembersOf(node, sourceFile) {
  /** @type {DocMember[]} */
  const result = [];
  for (const member of node.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name || ts.isPrivateIdentifier(member.name)) {
      continue;
    }
    const modifiers = ts.getModifiers(member) ?? [];
    if (
      modifiers.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
      )
    ) {
      continue;
    }
    const doc = leadingDoc(member, sourceFile);
    if (hasTag(doc, 'internal')) continue;
    const readonly = modifiers.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword);
    result.push({
      name: `${readonly ? 'readonly ' : ''}${textOf(member.name, sourceFile)}`,
      type: textOf(member.type, sourceFile) || 'unknown',
      optional: Boolean(member.questionToken),
      description: doc.summary,
    });
  }
  return result;
}

function typeParametersOf(node, sourceFile) {
  return node.typeParameters?.length
    ? `<${node.typeParameters.map((p) => textOf(p, sourceFile)).join(', ')}>`
    : '';
}

/** Kind of a function export from its name and return type. */
function functionKind(name, returns, fileName) {
  if (/^use[A-Z]/.test(name)) return 'hook';
  if (/^[A-Z]/.test(name) && (/JSX|ReactNode|Element/.test(returns) || fileName.endsWith('.tsx'))) {
    return 'component';
  }
  return 'function';
}

/** Docs of a function declaration, arrow function or function expression. */
function functionDoc(name, fn, doc, sourceFile) {
  const paramTags = doc.tags.filter((tag) => tag.tag === 'param');
  /** @type {Record<string, string>} */
  const propDefaults = {};
  let propsType;
  const params = fn.parameters.map((param) => {
    const isPattern = !ts.isIdentifier(param.name);
    const name = isPattern ? 'props' : textOf(param.name, sourceFile);
    if (isPattern && ts.isObjectBindingPattern(param.name)) {
      propsType = textOf(param.type, sourceFile) || undefined;
      for (const element of param.name.elements) {
        if (element.initializer && ts.isIdentifier(element.name)) {
          propDefaults[element.name.text] = textOf(element.initializer, sourceFile);
        }
      }
    }
    const tag = paramTags.find((item) => item.text.split(/\s/)[0] === name);
    return {
      name: `${param.dotDotDotToken ? '...' : ''}${name}`,
      type: textOf(param.type, sourceFile) || 'unknown',
      optional: Boolean(param.questionToken || param.initializer),
      defaultValue: param.initializer ? textOf(param.initializer, sourceFile) : undefined,
      description: tag ? tag.text.slice(name.length).replace(/^\s*-?\s*/, '') : '',
    };
  });
  const returns = textOf(fn.type, sourceFile);
  const paramList = params
    .map((p) => `${p.name}${p.optional && !p.defaultValue ? '?' : ''}: ${p.type}`)
    .join(', ');
  return {
    kind: functionKind(name, returns, sourceFile.fileName),
    signature: `${name}${typeParametersOf(fn, sourceFile)}(${paramList})${returns ? `: ${returns}` : ''}`,
    params,
    ...(returns ? { returns } : {}),
    ...(propsType ? { propsType } : {}),
    ...(Object.keys(propDefaults).length > 0 ? { propDefaults } : {}),
  };
}

/** Docs of a type alias: object types and intersections list their members. */
function typeAliasDoc(name, node, sourceFile) {
  const typeParams = typeParametersOf(node, sourceFile);
  const type = node.type;
  if (ts.isTypeLiteralNode(type)) {
    return {
      signature: `type ${name}${typeParams} = { … }`,
      members: membersOf(type.members, sourceFile),
    };
  }
  if (ts.isIntersectionTypeNode(type)) {
    const literals = type.types.filter(ts.isTypeLiteralNode);
    const others = type.types.filter((part) => !ts.isTypeLiteralNode(part));
    if (literals.length > 0) {
      const parts = [...others.map((part) => textOf(part, sourceFile)), '{ … }'];
      return {
        signature: `type ${name}${typeParams} = ${parts.join(' & ')}`,
        members: literals.flatMap((literal) => membersOf(literal.members, sourceFile)),
        extends: others.map((part) => textOf(part, sourceFile)),
      };
    }
  }
  return { signature: `type ${name}${typeParams} = ${textOf(type, sourceFile)}` };
}

const isExported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
  !(ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

/**
 * The documentation of every exported declaration in a file, in source order. Components get
 * the defaults from their props destructuring copied onto their props type's members.
 *
 * @param {string} fileName Used for the parser (`.tsx` enables JSX).
 * @param {string} content The file's text.
 * @returns {ExportDoc[]}
 */
export function extractDocs(fileName, content) {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  /** @type {ExportDoc[]} */
  const docs = [];
  const add = (name, doc, details) => {
    if (hasTag(doc, 'internal')) return;
    const deprecated = doc.tags.find((tag) => tag.tag === 'deprecated');
    const remarks = tagsNamed(doc, 'remarks');
    const returnsDescription = [...tagsNamed(doc, 'returns'), ...tagsNamed(doc, 'return')][0];
    docs.push({
      name,
      summary: [doc.summary, ...remarks].filter(Boolean).join('\n\n'),
      examples: tagsNamed(doc, 'example').map(exampleMarkdown),
      throws: tagsNamed(doc, 'throws'),
      ...(deprecated ? { deprecated: deprecated.text || 'Deprecated.' } : {}),
      ...(returnsDescription ? { returnsDescription } : {}),
      ...details,
    });
  };

  for (const statement of sourceFile.statements) {
    if (!isExported(statement)) continue;
    const doc = leadingDoc(statement, sourceFile);

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      add(name, doc, functionDoc(name, statement, doc, sourceFile));
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        const init = declaration.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          add(name, doc, functionDoc(name, init, doc, sourceFile));
          continue;
        }
        const type = textOf(declaration.type, sourceFile);
        const initText = textOf(init, sourceFile);
        const shown = type
          ? `: ${type}`
          : initText && initText.length <= 80
            ? ` = ${initText}`
            : '';
        add(name, doc, { kind: 'constant', signature: `const ${name}${shown}` });
      }
    } else if (ts.isInterfaceDeclaration(statement)) {
      const name = statement.name.text;
      const heritage = (statement.heritageClauses ?? []).flatMap((clause) =>
        clause.types.map((type) => textOf(type, sourceFile)),
      );
      add(name, doc, {
        kind: 'interface',
        signature: `interface ${name}${typeParametersOf(statement, sourceFile)}${heritage.length > 0 ? ` extends ${heritage.join(', ')}` : ''}`,
        members: membersOf(statement.members, sourceFile),
        ...(heritage.length > 0 ? { extends: heritage } : {}),
      });
    } else if (ts.isTypeAliasDeclaration(statement)) {
      const name = statement.name.text;
      add(name, doc, { kind: 'type', ...typeAliasDoc(name, statement, sourceFile) });
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const heritage = (statement.heritageClauses ?? []).flatMap((clause) =>
        clause.types.map((type) => textOf(type, sourceFile)),
      );
      const ctor = statement.members.find(ts.isConstructorDeclaration);
      const params = ctor
        ? functionDoc(name, ctor, leadingDoc(ctor, sourceFile), sourceFile).params
        : [];
      add(name, doc, {
        kind: 'class',
        signature: `class ${name}${typeParametersOf(statement, sourceFile)}${heritage.length > 0 ? ` extends ${heritage.join(', ')}` : ''}`,
        members: classMembersOf(statement, sourceFile),
        ...(params.length > 0 ? { params } : {}),
      });
    } else if (ts.isEnumDeclaration(statement)) {
      const name = statement.name.text;
      add(name, doc, {
        kind: 'enum',
        signature: `enum ${name}`,
        members: statement.members.map((member) => ({
          name: textOf(member.name, sourceFile),
          type: member.initializer ? textOf(member.initializer, sourceFile) : '',
          optional: false,
          description: leadingDoc(member, sourceFile).summary,
        })),
      });
    }
  }

  // Defaults written in a component's props destructuring (`asChild = false`) fill the gaps
  // in its props type's table.
  for (const doc of docs) {
    if (!doc.propsType || !doc.propDefaults) continue;
    const target = docs.find((other) => other.name === doc.propsType && other.members);
    for (const member of target?.members ?? []) {
      if (member.defaultValue === undefined && doc.propDefaults[member.name] !== undefined) {
        member.defaultValue = doc.propDefaults[member.name];
      }
    }
  }
  return docs;
}
