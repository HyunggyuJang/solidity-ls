var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  connection: () => connection,
  createServer: () => createServer,
  documents: () => documents,
  extensionPath: () => extensionPath,
  options: () => options,
  pathMap: () => pathMap,
  rootPath: () => rootPath,
  solidityMap: () => solidityMap
});
module.exports = __toCommonJS(src_exports);
var import_path3 = require("path");
var import_vscode_languageserver_textdocument2 = require("vscode-languageserver-textdocument");
var import_node2 = require("vscode-languageserver/node");
var import_vscode_uri = require("vscode-uri");

// src/compile.ts
var import_fs = require("fs");
var import_path = require("path");
var import_solc = __toESM(require("solc"));
var import_node = require("vscode-languageserver/node");
function compile(document) {
  const input = {
    language: "Solidity",
    sources: { [document.uri]: { content: document.getText() } },
    settings: { outputSelection: { "*": { "": ["ast"] } } }
  };
  const { remapping } = options;
  let solcLocal;
  try {
    solcLocal = import_solc.default.setupMethods(require(rootPath + "/node_modules/solc/soljson.js"));
  } catch (_) {
    solcLocal = import_solc.default;
  }
  const output = solcLocal.compile(JSON.stringify(input), {
    import(path) {
      try {
        let absolutePath = path;
        if (path.startsWith("file://")) {
          absolutePath = decodeURIComponent(path.substring(7));
        } else {
          absolutePath = getAbsolutePath(path);
          if (!(0, import_fs.existsSync)(absolutePath)) {
            for (const key in remapping) {
              if (path.startsWith(key)) {
                absolutePath = getAbsolutePath(path.replace(key, remapping[key]));
                break;
              }
            }
          }
        }
        pathMap[path] = absolutePath;
        return { contents: (0, import_fs.readFileSync)(absolutePath).toString() };
      } catch ({ message }) {
        return { error: message };
      }
    }
  });
  const { sources = {}, errors = [] } = JSON.parse(output);
  showErrors(document, errors);
  return Object.values(sources).map((i) => {
    const ast = i.ast;
    ast.absolutePath = getAbsolutePath(pathMap[ast.absolutePath] ?? ast.absolutePath);
    return ast;
  });
}
function getAbsolutePath(path) {
  if (path.startsWith("/"))
    return path;
  if (path.startsWith("file://")) {
    return decodeURIComponent(path.substring(7));
  }
  const includePath = (0, import_path.join)(rootPath, options.includePath);
  let absolutePath = (0, import_path.join)(rootPath, path);
  try {
    (0, import_fs.accessSync)(absolutePath);
  } catch (_) {
    absolutePath = (0, import_path.join)(includePath, path);
  }
  return absolutePath;
}
function showErrors(document, errors) {
  const diagnostics = [];
  for (const error of errors) {
    const { start = 0, end = 0 } = error.sourceLocation ?? {};
    const diagnostic = {
      severity: error.severity == "error" ? import_node.DiagnosticSeverity.Error : import_node.DiagnosticSeverity.Warning,
      range: import_node.Range.create(document.positionAt(start), document.positionAt(end)),
      message: error.formattedMessage.replace(/\s+-->.*/g, "").replace("\n\n", ""),
      code: error.errorCode
    };
    diagnostics.push(diagnostic);
  }
  connection?.sendDiagnostics({ uri: document.uri, diagnostics });
}

// src/completion/index.ts
var import_vscode_languageserver13 = require("vscode-languageserver");

// src/hover.ts
function onHover({ textDocument, position }) {
  const solidity = solidityMap.get(textDocument.uri);
  if (!solidity)
    return null;
  const node = solidity?.getDefinitionNode(position);
  if (!node)
    return null;
  const contents = [];
  const definitionInfo = getDefinitionInfo(node);
  if (definitionInfo) {
    contents.push(createContent(definitionInfo));
  }
  const parent = node.parent;
  if (parent.nodeType == "StructDefinition") {
    contents.push(createContent(`struct ${parent.name}`));
  }
  const documentation = Reflect.get(node, "documentation");
  if (documentation) {
    contents.push(createContent(documentation.text.replace(/\n /g, "\n")));
  }
  return { contents };
}
function createContent(value) {
  return { language: "solidity", value };
}
function getDefinitionInfo(node) {
  switch (node.nodeType) {
    case "StructDefinition":
      return getStructDefinition(node);
    case "FunctionDefinition":
      return getFunctionDefinition(node);
    case "VariableDeclaration":
      return getVariableDeclaration(node);
    case "ContractDefinition":
      return getContractDefinition(node);
  }
}
function getVariableDeclaration(node, struct = false) {
  const { typeName } = node;
  if (!typeName)
    return "";
  let declaration = getTypeName(typeName);
  if (node.storageLocation != "default") {
    declaration += ` ${node.storageLocation}`;
  }
  if (node.stateVariable) {
    declaration = `(state) ${declaration}`;
    if (node.visibility == "public") {
      declaration += " public";
    }
  }
  if (node.parent.nodeType == "StructDefinition" && !struct) {
    declaration = `(member) ${declaration}`;
  }
  return `${declaration}${node.name ? " " + node.name : ""}`;
}
function getTypeName(type) {
  switch (type.nodeType) {
    case "ElementaryTypeName":
      return `${type.name}`;
    case "ArrayTypeName":
      return `${getTypeName(type.baseType)}[]`;
    case "Mapping":
      const keyType = getTypeName(type.keyType);
      return `mapping(${keyType} => ${getTypeName(type.valueType)})`;
    case "UserDefinedTypeName":
      return `${type.pathNode?.name}`;
    default:
      return "unknown";
  }
}
function getStructDefinition(node) {
  let value = `struct ${node.name} {
`;
  for (const member of node.members) {
    value += `  ${getVariableDeclaration(member, true)};
`;
  }
  value += "}";
  return value;
}
function getFunctionDefinition(node) {
  let value = `function ${node.name}(`;
  value += node.parameters.parameters.map((param) => getVariableDeclaration(param)).join(", ");
  value += `) ${node.visibility}`;
  if (node.stateMutability != "nonpayable") {
    value += ` ${node.stateMutability}`;
  }
  if (node.virtual) {
    value += " virtual";
  }
  if (node.returnParameters.parameters.length) {
    value += ` returns (`;
    value += node.returnParameters.parameters.map((param) => getVariableDeclaration(param)).join(", ");
    value += `)`;
  }
  return value;
}
function getContractDefinition(node) {
  let value = `contract ${node.name}(`;
  const constructor = Reflect.get(node, "constructor");
  if (constructor) {
    value += constructor.parameters?.parameters.map((param) => getVariableDeclaration(param)).join(", ");
  }
  value += ")";
  return value;
}

// src/completion/abi.ts
var import_vscode_languageserver = require("vscode-languageserver");
var abi_default = [
  {
    label: "decode",
    detail: "abi.decode(bytes memory encodedData, (...)) returns (...)",
    documentation: "ABI-decodes the given data, while the types are given in parentheses as second argument. Example: `(uint a, uint[2] memory b, bytes memory c) = abi.decode(data, (uint, uint[2], bytes))`",
    kind: import_vscode_languageserver.CompletionItemKind.Method
  },
  {
    label: "encode",
    detail: "abi.encode(...) returns (bytes memory)",
    documentation: "ABI-encodes the given arguments",
    kind: import_vscode_languageserver.CompletionItemKind.Method
  },
  {
    label: "encodePacked",
    detail: "abi.encodePacked(...) returns (bytes memory)",
    documentation: "Performs packed encoding of the given arguments. Note that packed encoding can be ambiguous!",
    kind: import_vscode_languageserver.CompletionItemKind.Method
  },
  {
    label: "encodeWithSelector",
    detail: "abi.encodeWithSelector(bytes4 selector, ...) returns (bytes memory)",
    documentation: "ABI-encodes the given arguments starting from the second and prepends the given four-byte selector",
    kind: import_vscode_languageserver.CompletionItemKind.Method
  },
  {
    label: "encodeWithSignature",
    detail: "abi.encodeWithSignature(string memory signature, ...) returns (bytes memory)",
    documentation: "Equivalent to `abi.encodeWithSelector(bytes4(keccak256(bytes(signature))), ...)`",
    kind: import_vscode_languageserver.CompletionItemKind.Method
  },
  {
    label: "encodeCall",
    detail: "abi.encodeCall(function functionPointer, (...)) returns (bytes memory)",
    documentation: "ABI-encodes a call to `functionPointer` with the arguments found in the tuple. Performs a full type-check, ensuring the types match the function signature. Result equals `abi.encodeWithSelector(functionPointer.selector, (...))`",
    kind: import_vscode_languageserver.CompletionItemKind.Method
  }
];

// src/completion/address.ts
var import_vscode_languageserver2 = require("vscode-languageserver");
var address_default = [
  {
    label: "balance",
    detail: "<address>.balance (uint256)",
    documentation: "balance of the Address in Wei",
    kind: import_vscode_languageserver2.CompletionItemKind.Property
  },
  {
    label: "code",
    detail: "<address>.code (bytes memory)",
    documentation: "code at the Address (can be empty)",
    kind: import_vscode_languageserver2.CompletionItemKind.Property
  },
  {
    label: "codehash",
    detail: "<address>.codehash (bytes32)",
    documentation: "the codehash of the Address",
    kind: import_vscode_languageserver2.CompletionItemKind.Property
  },
  {
    label: "call",
    detail: "<address>.call(bytes memory) returns (bool, bytes memory)",
    documentation: "issue low-level `CALL` with the given payload, returns success condition and return data, forwards all available gas, adjustable",
    kind: import_vscode_languageserver2.CompletionItemKind.Method
  },
  {
    label: "delegatecall",
    detail: "<address>.delegatecall(bytes memory) returns (bool, bytes memory)",
    documentation: "issue low-level `DELEGATECALL` with the given payload, returns success condition and return data, forwards all available gas, adjustable",
    kind: import_vscode_languageserver2.CompletionItemKind.Method
  },
  {
    label: "staticcall",
    detail: "<address>.staticcall(bytes memory) returns (bool, bytes memory)",
    documentation: "issue low-level `STATICCALL` with the given payload, returns success condition and return data, forwards all available gas, adjustable",
    kind: import_vscode_languageserver2.CompletionItemKind.Method
  }
];

// src/completion/address-payable.ts
var import_vscode_languageserver3 = require("vscode-languageserver");
var address_payable_default = [
  ...address_default,
  {
    label: "transfer",
    detail: "<address payable>.transfer(uint256 amount)",
    documentation: "send given amount of Wei to Address, reverts on failure, forwards 2300 gas stipend, not adjustable",
    kind: import_vscode_languageserver3.CompletionItemKind.Method
  },
  {
    label: "send",
    detail: "<address payable>.send(uint256 amount) returns (bool)",
    documentation: "send given amount of Wei to Address, returns false on failure, forwards 2300 gas stipend, not adjustable",
    kind: import_vscode_languageserver3.CompletionItemKind.Method
  }
];

// src/completion/array.ts
var import_vscode_languageserver4 = require("vscode-languageserver");
var array_default = [
  {
    label: "length",
    detail: "(memer) uint256",
    documentation: "Arrays have a length member that contains their number of elements. The length of memory arrays is fixed (but dynamic, i.e. it can depend on runtime parameters) once they are created.",
    kind: import_vscode_languageserver4.CompletionItemKind.Property
  },
  {
    label: "push",
    detail: "push()",
    documentation: "Dynamic storage arrays and bytes (not string) have a member function called push() that you can use to append a zero-initialised element at the end of the array. It returns a reference to the element, so that it can be used like x.push().t = 2 or x.push() = b.",
    kind: import_vscode_languageserver4.CompletionItemKind.Method
  },
  {
    label: "push",
    detail: "push(x)",
    documentation: "Dynamic storage arrays and bytes (not string) have a member function called push(x) that you can use to append a given element at the end of the array. The function returns nothing.",
    kind: import_vscode_languageserver4.CompletionItemKind.Method
  },
  {
    label: "pop",
    detail: "pop()",
    documentation: "Dynamic storage arrays and bytes (not string) have a member function called pop() that you can use to remove an element from the end of the array. This also implicitly calls delete on the removed element.",
    kind: import_vscode_languageserver4.CompletionItemKind.Method
  }
];

// src/completion/block.ts
var import_vscode_languageserver5 = require("vscode-languageserver");
var block_default = [
  {
    label: "basefee",
    detail: "(member) uint",
    documentation: "current block\u2019s base fee (EIP-3198 and EIP-1559)",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  },
  {
    label: "chainid",
    detail: "(member) uint",
    documentation: "current chain id",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  },
  {
    label: "coinbase",
    detail: "(member) address payable",
    documentation: "current block miner\u2019s address",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  },
  {
    label: "difficulty",
    detail: "(member) uint",
    documentation: "current block difficulty",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  },
  {
    label: "gaslimit",
    detail: "(member) uint",
    documentation: "current block gaslimit",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  },
  {
    label: "number",
    detail: "(member) uint",
    documentation: "current block number",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  },
  {
    label: "timestamp",
    detail: "(member) uint",
    documentation: "current block timestamp as seconds since unix epoch",
    kind: import_vscode_languageserver5.CompletionItemKind.Property
  }
];

// src/completion/bytes.ts
var import_vscode_languageserver6 = require("vscode-languageserver");
var bytes_default = [
  {
    label: "concat",
    detail: "bytes.concat(...) returns (bytes memory)",
    documentation: "Concatenates variable number of bytes and bytes1, \u2026, bytes32 arguments to one byte array",
    kind: import_vscode_languageserver6.CompletionItemKind.Method
  }
];

// src/completion/contract.ts
var import_vscode_languageserver7 = require("vscode-languageserver");
var contract_default = [
  {
    label: "name",
    documentation: "The name of the contract.",
    kind: import_vscode_languageserver7.CompletionItemKind.Property
  },
  {
    label: "creationCode",
    documentation: "Memory byte array that contains the creation bytecode of the contract. This can be used in inline assembly to build custom creation routines, especially by using the create2 opcode. This property can not be accessed in the contract itself or any derived contract. It causes the bytecode to be included in the bytecode of the call site and thus circular references like that are not possible.",
    kind: import_vscode_languageserver7.CompletionItemKind.Property
  },
  {
    label: "runtimeCode",
    documentation: "Memory byte array that contains the runtime bytecode of the contract. This is the code that is usually deployed by the constructor of C. If C has a constructor that uses inline assembly, this might be different from the actually deployed bytecode. Also note that libraries modify their runtime bytecode at time of deployment to guard against regular calls. The same restrictions as with .creationCode also apply for this property.",
    kind: import_vscode_languageserver7.CompletionItemKind.Property
  }
];

// src/completion/elementary-type.ts
var elementaryTypes = [
  "address",
  "bool",
  "string",
  "bytes",
  "int",
  "int256",
  "uint",
  "uint256",
  "fixed",
  "ufixed"
];
var elementary_type_default = elementaryTypes.map((label) => ({ label }));

// src/completion/global-symbol.ts
var import_vscode_languageserver8 = require("vscode-languageserver");
var global_symbol_default = [
  {
    label: "msg",
    documentation: "message",
    kind: import_vscode_languageserver8.CompletionItemKind.Module
  },
  {
    label: "block",
    documentation: "current block",
    kind: import_vscode_languageserver8.CompletionItemKind.Module
  },
  {
    label: "tx",
    documentation: "current transaction",
    kind: import_vscode_languageserver8.CompletionItemKind.Module
  },
  {
    label: "blockhash",
    detail: "blockhash(uint blockNumber) returns (bytes32)",
    documentation: "hash of the given block when `blocknumber` is one of the 256 most recent blocks; otherwise returns zero",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "gasleft",
    detail: "gasleft() returns (uint256)",
    documentation: "remaining gas",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "abi",
    documentation: "ABI encoding and decoding",
    kind: import_vscode_languageserver8.CompletionItemKind.Module
  },
  {
    label: "assert",
    detail: "assert(bool condition)",
    documentation: "causes a Panic error and thus state change reversion if the condition is not met - to be used for internal errors.",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "require",
    detail: "require(bool condition, string message)",
    documentation: "reverts if the condition is not met - to be used for errors in inputs or external components. Also provides an error message.",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "revert",
    detail: "revert(string memory message)",
    documentation: "abort execution and revert state changes, providing an explanatory string",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "addmod",
    detail: "addmod(uint x, uint y, uint k) returns (uint)",
    documentation: "compute (x + y) % k where the addition is performed with arbitrary precision and does not wrap around at 2**256. Assert that k != 0 starting from version 0.5.0.",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "mulmod",
    detail: "mulmod(uint x, uint y, uint k) returns (uint)",
    documentation: "compute (x * y) % k where the multiplication is performed with arbitrary precision and does not wrap around at 2**256. Assert that k != 0 starting from version 0.5.0.",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "keccak256",
    detail: "keccak256(bytes memory) returns (bytes32)",
    documentation: "compute the Keccak-256 hash of the input",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "sha256",
    detail: "sha256(bytes memory) returns (bytes32)",
    documentation: "compute the SHA-256 hash of the input",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "ripemd160",
    detail: "ripemd160(bytes memory) returns (bytes32)",
    documentation: "compute the RIPEMD-160 hash of the input",
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  },
  {
    label: "ecrecover",
    detail: "ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address)",
    documentation: `recover the address associated with the public key from elliptic curve signature or return zero on error. The function parameters correspond to ECDSA values of the signature:
- r = first 32 bytes of signature
- s = second 32 bytes of signature
- v = final 1 byte of signature

ecrecover returns an address, and not an address payable. See address payable for conversion, in case you need to transfer funds to the recovered address.

## Warnning
If you use ecrecover, be aware that a valid signature can be turned into a different valid signature without requiring knowledge of the corresponding private key. In the Homestead hard fork, this issue was fixed for _transaction_ signatures (see EIP-2), but the ecrecover function remained unchanged.

This is usually not a problem unless you require signatures to be unique or use them to identify items. OpenZeppelin have a ECDSA helper library that you can use as a wrapper for ecrecover without this issue.`,
    kind: import_vscode_languageserver8.CompletionItemKind.Function
  }
];

// src/completion/keyword.ts
var import_vscode_languageserver9 = require("vscode-languageserver");
var keyword_default = [
  "emit",
  "revert",
  "abstract",
  "experimental",
  "override",
  "abicoder",
  "external",
  "pure",
  "view",
  "payable",
  "anonymous",
  "as",
  "break",
  "calldata",
  "constant",
  "immutable",
  "continue",
  "contract",
  "constructor",
  "receive",
  "fallback",
  "days",
  "delete",
  "do",
  "else",
  "enum",
  "ether",
  "event",
  "error",
  "false",
  "finney",
  "for",
  "from",
  "function",
  "get",
  "hex",
  "hours",
  "if",
  "try",
  "catch",
  "is",
  "indexed",
  "import",
  "interface",
  "internal",
  "library",
  "mapping",
  "memory",
  "minutes",
  "modifier",
  "new",
  "null",
  "private",
  "pragma",
  "public",
  "return",
  "returns",
  "seconds",
  "set",
  "solidity",
  "storage",
  "struct",
  "super",
  "szabo",
  "this",
  "throw",
  "true",
  "unicode",
  "using",
  "var",
  "weeks",
  "wei",
  "while",
  "years"
].map((label) => ({
  label,
  kind: import_vscode_languageserver9.CompletionItemKind.Keyword
}));

// src/completion/msg.ts
var import_vscode_languageserver10 = require("vscode-languageserver");
var msg_default = [
  {
    label: "data",
    detail: "(member) bytes calldata",
    documentation: "complete calldata",
    kind: import_vscode_languageserver10.CompletionItemKind.Property
  },
  {
    label: "sender",
    detail: "(member) address",
    documentation: "sender of the message (current call)",
    kind: import_vscode_languageserver10.CompletionItemKind.Property
  },
  {
    label: "sig",
    detail: "(member) bytes4",
    documentation: "first four bytes the calldata (i.e. function identifier)",
    kind: import_vscode_languageserver10.CompletionItemKind.Property
  }
];

// src/completion/string.ts
var import_vscode_languageserver11 = require("vscode-languageserver");
var string_default = [
  {
    label: "concat",
    detail: "string.concat(...) returns (string memory)",
    documentation: "Concatenates variable number of string arguments to one string array",
    kind: import_vscode_languageserver11.CompletionItemKind.Method
  }
];

// src/completion/tx.ts
var import_vscode_languageserver12 = require("vscode-languageserver");
var tx_default = [
  {
    label: "gasprice",
    detail: "(member) uint",
    documentation: "gas price of the transaction",
    kind: import_vscode_languageserver12.CompletionItemKind.Property
  },
  {
    label: "origin",
    detail: "(member) address",
    documentation: "sender of the transaction (full call chain)",
    kind: import_vscode_languageserver12.CompletionItemKind.Property
  }
];

// src/completion/index.ts
var completionitems = [];
async function onCompletion({
  textDocument,
  position,
  context
}) {
  completionitems = [];
  position.character -= 1;
  const solidity = solidityMap.get(textDocument.uri);
  if (!solidity)
    return null;
  const nodes = solidity.getCurrentNodes(position);
  const node = nodes[0];
  if (node) {
    if (node.nodeType == "FunctionCall" && node.kind == "structConstructorCall") {
      const nodeId = node.expression.referencedDeclaration;
      addCompletionItems(solidity, nodeId);
      return completionitems;
    }
  }
  if (context?.triggerKind == import_vscode_languageserver13.CompletionTriggerKind.TriggerCharacter) {
    const { typeString, typeIdentifier } = node?.typeDescriptions;
    if (!typeString || !typeIdentifier)
      return [];
    completionitems = completionitems.concat(completionsMap.get(typeString) ?? []);
    if (node.nodeType == "ElementaryTypeNameExpression") {
      completionitems = completionitems.concat(completionsMap.get(node.typeName.name) ?? []);
    }
    if (typeIdentifier.startsWith("t_array")) {
      completionitems = completionitems.concat(array_default);
    } else {
      const match = typeIdentifier.match(/\$(\d+)/);
      if (match) {
        const nodeId = parseInt(match[1]);
        if (typeIdentifier.startsWith("t_contract")) {
          const node2 = solidity.nodeMap.get(nodeId);
          for (const id of node2.linearizedBaseContracts) {
            addCompletionItems(solidity, id);
          }
        } else {
          addCompletionItems(solidity, nodeId);
        }
      }
    }
  } else {
    completionitems = [
      ...global_symbol_default,
      ...elementary_type_default,
      ...keyword_default
    ];
    for (const node2 of nodes) {
      switch (node2.nodeType) {
        case "ContractDefinition":
          for (const id of node2.linearizedBaseContracts) {
            addCompletionItems(solidity, id);
          }
          break;
        case "FunctionDefinition":
          addCompletionItems(solidity, node2.id);
          addCompletionItems(solidity, node2.body.id);
          break;
        case "Block":
        case "SourceUnit":
          addCompletionItems(solidity, node2.id);
          break;
      }
    }
    for (const node2 of solidity.definitions) {
      if (node2.nodeType == "ContractDefinition") {
        completionitems.push(createCompletionItem(node2));
      }
    }
  }
  return completionitems;
}
function addCompletionItems(solidity, nodeId) {
  for (const node of solidity.getAccesableNodes(nodeId)) {
    completionitems.push(createCompletionItem(node));
  }
}
function createCompletionItem(node) {
  let { name } = node;
  const item = import_vscode_languageserver13.CompletionItem.create(name);
  item.kind = kindMap.get(node.nodeType);
  item.documentation = Reflect.get(node, "documentation")?.text;
  item.detail = getDefinitionInfo(node);
  if (node.nodeType == "FunctionDefinition") {
    const params = node.parameters.parameters.map((i, index) => `\${${index + 1}:${i.name}}`).join(", ");
    item.insertText = `${node.name}(${params})`;
    item.insertTextFormat = import_vscode_languageserver13.InsertTextFormat.Snippet;
  }
  return item;
}
var kindMap = /* @__PURE__ */ new Map([
  ["VariableDeclaration", import_vscode_languageserver13.CompletionItemKind.Variable],
  ["FunctionDefinition", import_vscode_languageserver13.CompletionItemKind.Function],
  ["EventDefinition", import_vscode_languageserver13.CompletionItemKind.Event],
  ["StructDefinition", import_vscode_languageserver13.CompletionItemKind.Struct],
  ["EnumDefinition", import_vscode_languageserver13.CompletionItemKind.Enum],
  ["EnumValue", import_vscode_languageserver13.CompletionItemKind.EnumMember],
  ["ContractDefinition", import_vscode_languageserver13.CompletionItemKind.Class]
]);
var completionsMap = /* @__PURE__ */ new Map([
  ["block", block_default],
  ["msg", msg_default],
  ["tx", tx_default],
  ["abi", abi_default],
  ["bytes", bytes_default],
  ["string", string_default],
  ["address", address_default],
  ["address payable", address_payable_default]
]);

// src/definition.ts
var import_vscode_languageserver15 = require("vscode-languageserver");

// src/references.ts
var import_fs2 = require("fs");
var import_vscode_languageserver14 = require("vscode-languageserver");
var import_vscode_languageserver_textdocument = require("vscode-languageserver-textdocument");
function onReferences({
  textDocument: { uri },
  position
}) {
  return getReferences(uri, position).map(getIdentifierLocation);
}
function getReferences(uri, position) {
  const solidity = solidityMap.get(uri);
  if (!solidity)
    return [];
  const node = solidity.getCurrentNodes(position)[0];
  const nodeId = Reflect.get(node, "referencedDeclaration") ?? node.id;
  return solidity.identifiers.filter((i) => i.referencedDeclaration == nodeId || i.id == nodeId);
}
function getDocument({ root }) {
  const document = documents.get(root.absolutePath);
  if (document)
    return document;
  const path = getAbsolutePath(root.absolutePath);
  const content = (0, import_fs2.readFileSync)(path).toString();
  return import_vscode_languageserver_textdocument.TextDocument.create("file://" + path, "solidity", 0, content);
}
function getIdentifierLocation(node) {
  const document = getDocument(node);
  let { srcStart = 0, srcEnd = 0 } = node;
  let name = "";
  switch (node.nodeType) {
    case "Identifier":
    case "VariableDeclaration":
    case "UserDefinedTypeName":
      name = node.name ?? "";
      break;
    case "MemberAccess":
      name = node.memberName;
      break;
  }
  if (name) {
    srcStart += srcEnd - srcStart - name.length;
  } else if (node.nodeType.match(/Definition/)) {
    srcStart += node.nodeType.replace("Definition", "").length + 1;
    srcEnd = srcStart + Reflect.get(node, "name").length;
  }
  const range = import_vscode_languageserver14.Range.create(document.positionAt(srcStart), document.positionAt(srcEnd));
  return import_vscode_languageserver14.Location.create(document.uri, range);
}

// src/definition.ts
async function onDefinition({
  textDocument: { uri },
  position
}) {
  const solidity = solidityMap.get(uri);
  if (!solidity)
    return null;
  let node;
  node = solidity.getCurrentNodes(position)[0];
  if (!node)
    return null;
  if (node.nodeType == "ImportDirective") {
    const uri2 = pathMap[node.absolutePath] ?? node.absolutePath;
    return import_vscode_languageserver15.Location.create(uri2, import_vscode_languageserver15.Range.create(0, 0, 0, 0));
  } else {
    const ref = Reflect.get(node, "referencedDeclaration");
    if (ref)
      node = solidity.nodeMap.get(ref);
    if (!node)
      return null;
  }
  return getIdentifierLocation(node);
}

// src/formatting.ts
var import_path2 = require("path");
var import_vscode_languageserver16 = require("vscode-languageserver");
function onFormatting({
  textDocument: { uri }
}) {
  const document = documents.get(uri);
  if (!document)
    return [];
  const pluginName = "prettier-plugin-solidity";
  const { format, resolveConfig } = require("prettier");
  const formatted = format(document.getText(), {
    parser: "solidity-parse",
    plugins: [(0, import_path2.join)(__dirname, "..", "node_modules", pluginName)],
    ...resolveConfig.sync(document.uri)
  });
  return [
    import_vscode_languageserver16.TextEdit.replace(import_vscode_languageserver16.Range.create(0, 0, document.lineCount, 0), formatted)
  ];
}

// src/rename.ts
var import_vscode_languageserver17 = require("vscode-languageserver");
function onRename({
  textDocument: { uri },
  position,
  newName
}) {
  return getReferences(uri, position).reduce((previous, node) => {
    const { changes } = previous;
    const { uri: uri2, range } = getIdentifierLocation(node);
    if (!changes[uri2])
      changes[uri2] = [];
    changes[uri2].push(import_vscode_languageserver17.TextEdit.replace(range, newName));
    return previous;
  }, { changes: {} });
}

// src/signature-help.ts
function onSignatureHelp({
  textDocument: { uri },
  position
}) {
  const document = documents.get(uri);
  const solidity = solidityMap.get(uri);
  const line = document.getText().split("\n")[position.line];
  const functionName = line.match(/(\w+)\($/);
  if (!functionName)
    return;
  const node = solidity.definitions.find((i) => i.nodeType == "FunctionDefinition" && i.name == functionName[1]);
  if (!node)
    return;
  const signature = {
    label: getFunctionDefinition(node),
    documentation: node.documentation?.text,
    parameters: node.parameters.parameters.map((param) => ({
      label: param.name
    })),
    activeParameter: 0
  };
  return {
    signatures: [signature],
    activeParameter: null,
    activeSignature: null
  };
}

// src/parse.ts
function parse(node, root, identifiers, definitions, scopes, nodes, nodeMap) {
  node.root = root;
  const position = node.src.split(":").map((i) => parseInt(i));
  node.srcStart = position[0];
  node.srcEnd = position[0] + position[1];
  nodes.push(node);
  nodeMap.set(node.id, node);
  let children = [];
  switch (node.nodeType) {
    case "ContractDefinition":
    case "StructDefinition":
    case "FunctionDefinition":
    case "VariableDeclaration":
    case "EventDefinition":
    case "EnumDefinition":
    case "ErrorDefinition":
      definitions.push(node);
      const scopeId = Reflect.get(node, "scope") ?? Reflect.get(node.parent, "scope");
      const scope = scopes.get(scopeId);
      if (scope) {
        scope.push(node);
      } else {
        scopes.set(scopeId, [node]);
      }
    case "Identifier":
    case "MemberAccess":
    case "UserDefinedTypeName":
    case "IdentifierPath":
      identifiers.push(node);
      break;
  }
  switch (node.nodeType) {
    case "SourceUnit":
      children = node.nodes;
      break;
    case "ContractDefinition":
      children = [...node.baseContracts.map((i) => i.baseName), ...node.nodes];
      break;
    case "StructDefinition":
      children = node.members;
      break;
    case "FunctionDefinition":
      if (node.kind == "constructor") {
        Reflect.set(nodeMap.get(node.scope), "constructor", node);
      }
      children = [
        ...node.parameters.parameters,
        ...node.modifiers.map((i) => i.modifierName),
        ...node.overrides?.overrides ?? [],
        ...node.returnParameters.parameters,
        ...getStatements(node.body)
      ];
      break;
    case "ExpressionStatement":
      children = [node.expression];
      break;
    case "Assignment":
      children = [node.leftHandSide, node.rightHandSide];
      break;
    case "MemberAccess":
      children = [node.expression];
      break;
    case "IndexAccess":
      children = [node.baseExpression, node.indexExpression];
      break;
    case "ForStatement":
      children = [
        node.initializationExpression,
        node.condition,
        node.loopExpression,
        ...getStatements(node.body)
      ];
      break;
    case "WhileStatement":
      children = [node.condition, ...getStatements(node.body)];
      break;
    case "IfStatement":
      children = [
        node.condition,
        ...getStatements(node.trueBody),
        ...getStatements(node.falseBody)
      ];
      break;
    case "VariableDeclarationStatement":
      children = node.declarations;
      if (node.initialValue) {
        children.push(node.initialValue);
      }
      break;
    case "BinaryOperation":
      children = [node.leftExpression, node.rightExpression];
      break;
    case "FunctionCall":
      children = [node.expression, ...node.arguments];
      break;
    case "UnaryOperation":
      children = [node.subExpression];
      break;
    case "VariableDeclaration":
      if (node.typeName) {
        children = [node.typeName];
      }
      break;
    case "ArrayTypeName":
      children = [node.baseType];
      break;
    case "EmitStatement":
      children = [node.eventCall];
      break;
    case "Return":
      children = [node.expression];
      break;
    case "UncheckedBlock":
      children = node.statements;
      break;
    case "Mapping":
      children = [node.keyType, node.valueType];
      break;
  }
  for (const child of children) {
    if (!child)
      continue;
    child.parent = node;
    parse(child, root, identifiers, definitions, scopes, nodes, nodeMap);
  }
}
function getStatements(body) {
  if (!body)
    return [];
  if (body.nodeType == "Block")
    return body.statements ?? [];
  return [body];
}

// src/solidity.ts
var Solidity = class {
  document;
  identifiers = [];
  definitions = [];
  nodes = /* @__PURE__ */ new Map();
  scopes = /* @__PURE__ */ new Map();
  astMap = /* @__PURE__ */ new Map();
  nodeMap = /* @__PURE__ */ new Map();
  constructor(document, sources) {
    this.document = document;
    for (const root of sources) {
      const uri = root.absolutePath;
      this.astMap.set(uri, root);
      if (!this.nodes.has(uri)) {
        this.nodes.set(uri, []);
      }
      parse(root, root, this.identifiers, this.definitions, this.scopes, this.nodes.get(uri), this.nodeMap);
    }
  }
  getDefinitionNode(position) {
    const node = this.getCurrentNodes(position)[0];
    if (!node)
      return null;
    if (node.nodeType == "ImportDirective") {
      return node;
    } else {
      const ref = Reflect.get(node, "referencedDeclaration");
      if (ref)
        return this.nodeMap.get(ref);
    }
    return null;
  }
  getCurrentNodes(position) {
    const offset = this.document.offsetAt(position);
    const nodes = this.nodes.get(getAbsolutePath(this.document.uri));
    if (!nodes)
      return [];
    const selected = [];
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.srcStart <= offset && offset <= node.srcEnd) {
        selected.push(node);
      }
    }
    return selected;
  }
  getAccesableNodes(nodeId) {
    return (this.scopes.get(nodeId) ?? []).filter((node) => {
      if (node.nodeType == "VariableDeclaration" && node.visibility == "private") {
        return false;
      }
      if (node.nodeType == "FunctionDefinition" && node.kind == "constructor") {
        return false;
      }
      if (node.nodeType == "ContractDefinition") {
        return false;
      }
      return true;
    });
  }
};

// src/index.ts
var options = {
  includePath: "node_modules",
  remapping: {}
};
var rootPath = (0, import_path3.join)(__dirname, "..");
var extensionPath;
var connection;
var documents;
var solidityMap = /* @__PURE__ */ new Map();
var pathMap = {};
function createServer(input, output) {
  if (input && output) {
    connection = (0, import_node2.createConnection)(input, output);
  } else {
    connection = (0, import_node2.createConnection)();
  }
  connection.onDocumentFormatting(onFormatting);
  connection.onDefinition(onDefinition);
  connection.onHover(onHover);
  connection.onCompletion(onCompletion);
  connection.onRenameRequest(onRename);
  connection.onReferences(onReferences);
  connection.onSignatureHelp(onSignatureHelp);
  connection.onDidChangeConfiguration(({ settings }) => {
    options = settings.solidity;
  });
  connection.onInitialize(({ workspaceFolders, initializationOptions }) => {
    const uri = workspaceFolders?.[0]?.uri;
    if (uri) {
      rootPath = import_vscode_uri.URI.parse(uri).path;
    }
    extensionPath = initializationOptions.extensionPath;
    return {
      capabilities: {
        hoverProvider: true,
        documentFormattingProvider: true,
        definitionProvider: true,
        completionProvider: { triggerCharacters: ["."] },
        renameProvider: true,
        referencesProvider: true,
        signatureHelpProvider: { triggerCharacters: ["("] }
      }
    };
  });
  documents = new import_node2.TextDocuments(import_vscode_languageserver_textdocument2.TextDocument);
  documents.listen(connection);
  documents.onDidChangeContent(({ document }) => {
    const result = compile(document);
    if (result.length) {
      solidityMap.set(document.uri, new Solidity(document, result));
    }
    setTimeout(() => require("prettier"), 0);
  });
  connection.listen();
  return connection;
}
if (require.main == module) {
  createServer();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  connection,
  createServer,
  documents,
  extensionPath,
  options,
  pathMap,
  rootPath,
  solidityMap
});
//# sourceMappingURL=index.js.map
