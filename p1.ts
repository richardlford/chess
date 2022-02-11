// Create a map from enum keys to key names.
// This is handier for iterating.
function enumMap<T extends number>(e: object) : Map<T, string> {
    let result = new Map<T, string>();
    for (const key in e) {
        if (Object.prototype.hasOwnProperty.call(e, key)) {
            const element = e[key];
            if (typeof element == "number") {
                result.set(element as T, key);
            }
        }
    }
    return result;
}

// -------------------------- Types -----------------------
enum Clr { w, b}
var clrMap = enumMap<Clr>(Clr);

enum Kind { K, Q, R, B, N, P}
var kindMap = enumMap<Kind>(Kind);

enum SpriteId {
    None,
    wR1, wN2, wB3, wQ4, wK5, wB6, wN7, wR8,
    wP1, wP2, wP3, wP4, wP5, wP6, wP7, wP8,
    bR1, bN2, bB3, bQ4, bK5, bB6, bN7, bR8,
    bP1, bP2, bP3, bP4, bP5, bP6, bP7, bP8
}
var spriteIdMap = enumMap<SpriteId>(SpriteId);

type Position = [file: number, rank: number];

// Information about a sprite that does not change and is independent
// of state.
interface ConstantSpriteInfo {
    index: SpriteId;
    name: string;
    color: Clr;
    kind: Kind;
    originalPosition: Position;
}

// This is a 12 rows x 8 columns matrix.
// Rows 0..1 are capture area for captured white pieces.
// Rows 2..9 are for board ranks 8..1
// Rows 10..11 are capture area for captured black pieces.
type BoardMatrix<ElementType> = ElementType[][];

// This is the type of first (row) index into a BoardMatrix.
// 0 is the top row in the display.
type BoardRowIndex = number;

type SpriteArray<ElementType> = ElementType[];

// A Chess rank, except we use 0..7 internally.
type Rank = number;

interface ViewType {
    // We save these when we make them to avoid the overhead
    // of looking up by id.
    squareElements: BoardMatrix<HTMLElement>;
}

// Information for a sprite that depends on state.
interface StateSpriteInfo {
    // Duplicates info from view, but used to correlate.
    index: SpriteId;

    // Kind can change on pawn promotion.
    kind: Kind;

    // Current position. This must agree with state.squareSprites.
    // Captured sprites will be out of bounds.
    position: Position;
}

interface StateType {
    // Starts at 1 and only advances when white's turn to 
    // move again. Combined with the color it defines a 
    // single move. We can use 1w for move 1 by white and
    // 1b for move 1 by black.
    moveNumber: number;

    // Whose move is it.
    whoseMove: Clr;

    // This is a record of what sprite (or null) is currently
    // currently stored in each square. 
    squareSprites: BoardMatrix<SpriteId>;

    // Sprite information that depends on the state.
    spriteStateInfo: StateSpriteInfo[];

    // Location where a pawn can move to capture another
    // pawn that just move 2 spaces.
    enPassantPosition: Position | null;

    // The enPassant pawn that could be captured.
    enPassantPawn: SpriteId;

    // Tells if the given sprite has moved.
    haveMoved: SpriteArray<boolean>;
}

// Move of a single piece
interface Move {
    from: Position;
    to: Position;
}

// The pieces that move in a turn.
interface Turn {
    // The main piece that moved.
    primary: Move;

    // Others that move:
    // - A piece that is captured is moved to the capture area
    // - When castling, the rook moves.
    secondary: Move | null;
}

// -------------------------- Global Variables -----------------------

// spriteInfo[spriteId] gives the constant information for a sprite.
var spriteInfo: ConstantSpriteInfo[] = [];

var view : ViewType = {
    squareElements: [],
}

// The current state.
var state: StateType = {
    moveNumber: 1,
    whoseMove: Clr.w,
    squareSprites: [],
    spriteStateInfo: [],
    enPassantPosition: null,
    enPassantPawn: SpriteId.None,
    haveMoved: makeArray(32, false)
}

// A record of all states.
var states: StateType[] = [];

var selectedSprite: SpriteId = 0;

// -------------------------- Functions -----------------------

function getSpriteInfo(id: SpriteId) : ConstantSpriteInfo {
    return spriteInfo[id];
}

function makeSprites() {
    for (const [idIndex, idText] of spriteIdMap!) {
        if (idIndex == 0) {
            // The None sprite.
            let noSprite: ConstantSpriteInfo = 
            {
                index: idIndex,
                name: idText,
                color: Clr.w,
                kind: Kind.P,
                originalPosition: [0, -1]
            }
            spriteInfo.push(noSprite);
        } else {
            let file: number = Number(idText.substring(2,3)) - 1;
            let kindText: string = idText.substring(1, 2);
            let kind: Kind = Kind[kindText];
            let colorText: string = idText.substring(0, 1);
            let color: Clr = Clr[colorText];
            let rank: number = (kind == Kind.P ? 1 : 0);
            if (color == Clr.b) {
                rank = 7 - rank;
            }
            let sprite: ConstantSpriteInfo = 
            {
                index: idIndex,
                name: idText,
                color: color,
                kind: kind,
                originalPosition: [file, rank],
            }
            spriteInfo.push(sprite);
        }
    }
}

function rank2boardRow(r: Rank) : BoardRowIndex {
    return 9 - r;
}

function boardRow2rank(b: BoardRowIndex) : Rank {
    return 9 - b;
}

// Shallow copy of array.
function shallowArrayCopy<T>(ray: T[]) : T[] {
    return [...ray];
}

function matrixCopy<T>(m: T[][]) : T[][] {
    let result: T[][] = [];
    m.forEach(row => {
        result.push([...row]);
    });
    return result;
}

// Functional update that does not modify the input matrix.
function updateMatrix<T>(m: T[][], [modFile, modRow]: Position, value: T) : T[][] {
    let result: T[][] = [];
    for (let mrow = 0; mrow < m.length; mrow++) {
        const row = m[mrow];
        if (mrow == modRow) {
            // This is the row we are modifying.
            let newRow: T[] = [];
            for (let mfile = 0; mfile < row.length; mfile++) {
                const element = row[mfile];
                if (mfile == modFile) {
                    // The file being modified.
                    newRow.push(value);
                } else {
                    newRow.push(element);
                }
            }
            result.push(newRow);
        } else {
            // An unmodified row.
            result.push(row);
        }
    }
    return result;
}

function updateBoard<T>(board: BoardMatrix<T>, [file, rank]: Position, value: T) : BoardMatrix<T> {
    return updateMatrix(board, [file, rank2boardRow(rank)], value);
}

function makeArray<T>(n: number, val: T) : T[] {
    let result: T[] = [];
    for (let index = 0; index < n; index++) {
        result.push(val);
    }
    return result;
}

// Functions to create HTML for the user interface.

function makeHeaderRow(data: string[]) : HTMLElement {
    let tr = document.createElement("tr");
    data.forEach(element => {
        let th = document.createElement("th");
        th.innerHTML = element;
        tr.appendChild(th);
    });
    return tr;
}

function makeCapturedRow(rank: number) : HTMLElement {
    let tr = document.createElement("tr");
    tr.appendChild(document.createElement("td"));
    let elms: HTMLElement[] = [];
    for (let file = 0; file < 8; file++) {
        let td = document.createElement("td");
        let ida = document.createAttribute("id");
        ida.value = `square${file}${rank}`
        td.setAttributeNode(ida);
        let classAttr = document.createAttribute("class");
        classAttr.value = "captured";
        td.setAttributeNode(classAttr);
        tr.appendChild(td);
        elms.push(td);
    }
    view.squareElements.push(elms);
    tr.appendChild(document.createElement("td"));
    return tr;
}

function makeRegularRow(rank: number) : HTMLElement {
    let tr = document.createElement("tr");
    let tdCaption = document.createElement("td");
    tdCaption.innerText = `${rank+1}`;
    tr.appendChild(tdCaption);
    let elms: HTMLElement[] = [];
    for (let file = 0; file < 8; file++) {
        let td = document.createElement("td");
        let ida = document.createAttribute("id");
        ida.value = `square${file}${rank}`
        td.setAttributeNode(ida);
        let classAttr = document.createAttribute("class");
        classAttr.value = ((file+rank)%2 == 0? "black" : "white");
        td.setAttributeNode(classAttr);
        let onclickAttr = document.createAttribute("onclick");
        onclickAttr.value = `doClick(${file},${rank})`
        td.setAttributeNode(onclickAttr);
        tr.appendChild(td);
        elms.push(td);
    }
    view.squareElements.push(elms);
    tdCaption = document.createElement("td");
    tdCaption.innerText = `${rank+1}`;
    tr.appendChild(tdCaption);
    return tr;
}

// Once-only initalization of the view object.
// Its elements are null lists initially.
// Create HTML elements, recording them in the 
// view object for efficiency.
// Also make the squarePieces matrix, initially all null.
function initializeView() {
    const atbody = document.getElementById("chessBoard");
    atbody?.appendChild(makeCapturedRow(9));
    atbody?.appendChild(makeCapturedRow(8));
    atbody?.appendChild(makeHeaderRow(["", "A", "B", "C", "D", "E", "F", "G", "H", ""]));
    for (let rank = 7; rank >= 0; rank--) {
        atbody?.appendChild(makeRegularRow(rank));
    }
    atbody?.appendChild(makeHeaderRow(["", "A", "B", "C", "D", "E", "F", "G", "H", ""]));
    atbody?.appendChild(makeCapturedRow(-1));
    atbody?.appendChild(makeCapturedRow(-2));
}

function getViewSquare(pos: Position) : HTMLElement {
    let [file, rank] = pos;
    return view.squareElements[rank2boardRow(rank)][file];
}

function getOriginalSpriteKind(sprite: SpriteId) : Kind{
    return spriteInfo[sprite].kind;
}

function getStateSpriteId(aState: StateType, pos: Position): SpriteId {
    let [file, rank] = pos;
    return aState.squareSprites[rank2boardRow(rank)][file];
}

function setStateSpriteId(aState: StateType, pos: Position, spriteNum: SpriteId) {
    let [file, rank] = pos;
    aState.squareSprites[rank2boardRow(rank)][file] = spriteNum;
}

function resetView() {
    // First clear the whole board.
    view.squareElements.forEach(row => {
        row.forEach(square => {
            square.innerHTML = "";
        });
    });

    spriteInfo.forEach(sprite => {
        let square = getViewSquare(sprite.originalPosition);
        let costumeName = sprite.name.substring(0, 2);
        let inner = `<img src="images/${costumeName}.png">`;
        square.innerHTML = inner;
    });
}

function initializeState() {
    // Make SquareSpites.
    for (let index = 0; index < 12; index++) {
        state.squareSprites.push(makeArray(8, SpriteId.None));
    }

    let infos: StateSpriteInfo[] = [];
    spriteInfo.forEach(spriteInfo => {
        let sprite = spriteInfo.index;
        let loc = spriteInfo.originalPosition;
        setStateSpriteId(state, loc, sprite);
        let stateSpriteInfo: StateSpriteInfo = {
            index: sprite,
            kind: spriteInfo.kind,
            position: loc
        }
        infos.push(stateSpriteInfo);
    });
    state.spriteStateInfo = infos;
    states.push(state);
}

function myLoaded() {
    console.log("Main page loaded")
    initializeView();
    makeSprites();
    resetView();
    initializeState();
}

function outOfRange(arg: number | number[]) : boolean {
    if (typeof arg == "number") {
        return (arg < 0) || (arg > 7);
    } else {
        for (let index = 0; index < arg.length; index++) {
            const element = arg[index];
            if (outOfRange(element)) {
                return true;
            }
        }
    }
    return false;
}

function myAssert(condition: boolean, message: string) {
    if (!condition) {
        throw message;
    }
}

function getSpriteColor(index: SpriteId) : Clr {
    myAssert(index > 0, "Invalid sprite number");
    return spriteInfo[index].color;
}

function posAssign([file, rank]: Position) : Position {
    return [file, rank];
}

function posAbs([file, rank]: Position) : Position {
    return [Math.abs(file), Math.abs(rank)];
}

function posAdd([f1, r1]:Position, [f2,r2]: Position) : Position {
    return [f1+f2, r1+r2];
}

function posScalarMult(scalar: number, [f1, r1]:Position) : Position {
    return [scalar * f1, scalar * r1];
}

function posScalarDiv([f1, r1]:Position, scalar: number) : Position {
    return [f1 / scalar, r1 / scalar];
}

function posEq([f1, r1]:Position, [f2,r2]: Position) : boolean {
    return (f1==f2) && (r1==r2);
}

// Returns potential moves and id of captured Pawn, if any]
function pawnmoves(sprite: SpriteId, defence: boolean, captureOnly: boolean, loc: Position, 
    aState: StateType): Turn[] {
    let result: Turn[] = [];
    let capturedPawn: SpriteId = SpriteId.None;
    let [file, rank] = loc;
    let myColor = getSpriteColor(sprite);
    myAssert(!captureOnly|| defence, "If captureOnly, defense must be on!");
    let pawnDiry: number;
    let startRank: number;
    if (myColor == Clr.w) {
        pawnDiry = 1;
        startRank = 1;
    } else {
        pawnDiry = -1;
        startRank = 6;
    }
    let enPassant = aState.enPassantPosition;
    let dirs: Position[] = [[0, pawnDiry], [1, pawnDiry], [-1, pawnDiry]];
    for (const dir of dirs) {
        let dx = dir[0];
        for (let i = 1; i <= 2; i++) {
            if ((i == 2) && ((dx != 0) || (rank != startRank))) {
                break;
            }
            let dest: Position = posAdd(loc, posScalarMult(i, dir));
            let pmove: Move = { from: [...loc], to: dest};
            if (outOfRange(dest)) {
                break;
            }
            let destSprite: SpriteId = getStateSpriteId(aState, dest);
            if (destSprite) {
                let destColor = getSpriteColor(destSprite);
                if (dx != 0) {
                    if (destColor == myColor) {
                        if (defence) {
                            let turn: Turn = { primary: pmove, secondary: null };
                            result.push(turn);
                        }
                    } else {
                        let capLoc = capturedLocation(destSprite);
                        let capMove: Move = { from: dest, to: capLoc};
                        let turn: Turn = { primary: pmove, secondary: capMove};
                        result.push(turn); // Capture
                    }
                } else {
                    // Going straight and a piece in the way.
                }
                break; // Cannot move past a piece.
            } else {
                // No piece at destination.
                if (dx == 0) {
                    if (!captureOnly) {
                        let turn: Turn = { primary: pmove, secondary: null };
                        result.push(turn);
                    }
                } else {
                    if (enPassant && posEq(dest, enPassant)) {
                        let enpSprite = state.enPassantPawn;
                        let enpLoc = state.spriteStateInfo[enpSprite].position;
                        let capLoc = capturedLocation(enpSprite );
                        let enpMove: Move = { from: enpLoc, to: capLoc};
                        let turn: Turn = { primary: pmove, secondary: enpMove};
                        result.push(turn);
                        capturedPawn = aState.enPassantPawn;
                    }
                }
            }
        }
    }
    return result;
}

function underAttack(aState: StateType, pos: Position) : boolean {
    // TODO
    return false;
}

function castleOK(aState: StateType, kingSide: boolean) : boolean {
    let color: Clr = aState.whoseMove;
    let r1 = color==Clr.w ? SpriteId.wR1 : SpriteId.bR1;
    let r8 = color==Clr.w ? SpriteId.wR8 : SpriteId.bR8;
    let k = color==Clr.w ? SpriteId.wK5 : SpriteId.bK5;
    let rank = color==Clr.w ? 0 : 7;
    let intervening: Position[] = kingSide ?
        [[5, rank], [6,rank]] :
        [[1, rank], [2,rank], [3, rank]];
    let r = kingSide ? r8 : r1;
    let moved = state.haveMoved;
    if (moved[k] || moved[r]) {
        return false;
    }
    for (const pos of intervening) {
        let sprite = getStateSpriteId(aState, pos);
        if (sprite) {
            return false; // Not vacant.
        }
        if (underAttack(aState, pos)) {
            return false;
        }
    }

    return true;
}

function majorPieceMoves(sprite: SpriteId, defence: boolean, loc: Position, 
    aState: StateType): Turn[] {
    let result: Turn[] = [];
    let [file, rank] = loc;
    let myColor = getSpriteColor(sprite);
    let myKind = aState.spriteStateInfo[sprite].kind;
    let kstr = kindMap.get(myKind);
    let dirs: Position[] = [];
    if (myKind == Kind.N) {
        dirs = [[2, 1], [1,2], [-1, 2], [-2,1], 
                [-2, -1], [-1,-2], [1, -2], [2, -1]];
    } else {
        if ("BQK".indexOf(kstr!) >= 0) {
            dirs.push([1,1], [1,-1], [-1,1], [-1, -1]);
        }
        if ("RQK".indexOf(kstr!) >= 0) {
            dirs.push([1,0], [-1,0], [0,1], [0, -1]);
        }
    }
    for (const dir of dirs) {
        for (let i = 1; i <= 8; i++) {
            if (("NK".indexOf(kstr!) >= 0) && (i > 1)) {
                break;
            }
            let dest: Position = posAdd(loc, posScalarMult(i, dir));
            if (outOfRange(dest)) {
                break;
            }
            let pmove: Move = { from: [...loc], to: dest};
            let destSprite: SpriteId = getStateSpriteId(aState, dest);
            if (destSprite) {
                let destColor = getSpriteColor(destSprite);
                if (destColor == myColor) {
                    if (defence) {
                        let turn : Turn = { primary: pmove, secondary: null };
                        result.push(turn);
                    }
                } else {
                    let capLoc = capturedLocation(destSprite);
                    let capMove: Move = { from: dest, to: capLoc};
                    let turn: Turn = { primary: pmove, secondary: capMove};
                    result.push(turn); // Capture
                }
                break; // Cannot move past a piece.
            } else {
                // No piece at destination.
                let turn : Turn = { primary: pmove, secondary: null };
                result.push(turn);
            }
        }
    }
    if (myKind == Kind.K) {
        // Check for castling possibilities.
        for (const kingSide of [false, true]) {
            if (castleOK(aState, kingSide)) {
                let kdx = kingSide ? 2 : -2;
                let rdx = kingSide ? -2 : 3;
                let rstartx = kingSide ? 7 : 0;
                let dest: Position = posAdd(loc, [kdx, 0]);
                let rstart: Position = [rstartx, rank];
                let rend: Position = [rstartx + rdx, rank];
                let kmove: Move = { from: loc, to: dest};
                let rmove: Move = { from: rstart, to: rend};
                let turn: Turn = { primary: kmove, secondary: rmove};
                result.push(turn);
            }
        }
    }
    return result;
}

function potentialMoves(defence: boolean, captureOnly: boolean, loc: Position, 
    aState: StateType): Turn[] {
    let sprite: SpriteId = getStateSpriteId(aState, loc);
    myAssert(Boolean(sprite), "Error in potentialMoves:There's no sprite here!");
    let kind = aState.spriteStateInfo[sprite].kind;
    if (kind==Kind.P) {
        return pawnmoves(sprite, defence, captureOnly, loc, aState);   
    } else {
        return majorPieceMoves(sprite, defence, loc, aState);
    }
}

// Compute the location to display a captured piece.
function capturedLocation(sprite: SpriteId) : Position {
    let info = spriteInfo[sprite];
    let origLoc = info.originalPosition;
    let color = info.color;
    let dy = (color == Clr.w) ? 8 : -8;
    let capLoc = posAdd(origLoc, [0, dy]);
    return capLoc;
}

function getPromotionKind() : Kind {
    // Pawn promotion.
    let newKindStr: string | null = "x";
    while ("QRBN".indexOf(newKindStr) == -1) {
        newKindStr = prompt("What do you want the pawn to be (QRBN)?", "Q") || "";
        myAssert(newKindStr != null, "No promotion option chosen");
    }
    let newKind = Kind[newKindStr];
    return newKind;
}

// Returns the new state and the list of positions that have changed.
function stateAfterMove(turn: Turn, fromState: StateType,
        promoKind: Kind | null) : [StateType, Position[]] {
    // Process the secondary first, so we do not wipe out its
    // information when the primary captures it.
    let secondary: Move | null = turn.secondary;
    let newBoard0 = fromState.squareSprites;
    let newBoard2 = newBoard0;
    let changedPositions: Position[] = [];
    let sinfo = [...fromState.spriteStateInfo];
    let newHaveMoved = [...fromState.haveMoved];
    if (secondary) {
        let {from: sfrom, to: sto} = secondary;
        let capturedOther: SpriteId = getStateSpriteId(fromState, sfrom);
        // First erase from old location.
        let newBoard1 = updateBoard(newBoard0, sfrom, SpriteId.None);
        // Now record in new location.
        newBoard2 = updateBoard(newBoard1, sto, capturedOther);
        changedPositions.push(sfrom, sto);
        let oldsInfo = sinfo[capturedOther];
        let newsInfo = {
            index: capturedOther,
            kind: oldsInfo.kind,
            position: sto
        }
        sinfo[capturedOther] = newsInfo;
        newHaveMoved[capturedOther] = true;
    }

    let {from: oldLoc, to: pos} = turn.primary;
    let sprite = getStateSpriteId(fromState, oldLoc);
    let oldInfo = sinfo[sprite];
    changedPositions.push(oldLoc, pos);
    let oldKind = oldInfo.kind;
    let newKind = promoKind || oldKind;
    let newInfo = {
        index: sprite,
        kind: newKind, 
        position: pos
    }
    sinfo[sprite] = newInfo;

    // First erase from old location.
    let newBoard3 = updateBoard(newBoard2, oldLoc, SpriteId.None);
    // Now record in new location.
    let newBoard4 = updateBoard(newBoard3, pos, sprite);
    let newMove = (fromState.whoseMove == Clr.b) ? fromState.moveNumber + 1: fromState.moveNumber;
    let newWhose = Clr.b - fromState.whoseMove;
    let newEnPassantPosition: Position | null = null;
    let newEnPassantSprite = SpriteId.None;
    if ((oldKind == Kind.P)) {
        let dloc: Position = posAdd(pos, posScalarMult(-1, oldLoc));
        let origLoc = spriteInfo[sprite].originalPosition;
        if (posEq(origLoc, oldLoc) && posEq(posAbs(dloc), [0, 2])) {
            newEnPassantSprite = sprite;
            newEnPassantPosition = posAdd(oldLoc, posScalarDiv(dloc, 2));
        }
    }
    newHaveMoved[sprite] = true;
    let newState: StateType = {
        moveNumber: newMove,
        whoseMove: newWhose,
        squareSprites: newBoard4,
        spriteStateInfo: sinfo,
        enPassantPosition: newEnPassantPosition,
        enPassantPawn: newEnPassantSprite,
        haveMoved: newHaveMoved
    }
    return [newState, changedPositions];
}

function updateViewAtLocation(pos: Position, color: Clr | null, kind: Kind) {
    let square: HTMLElement = getViewSquare(pos);
    let newInner = "";
    if (color != null) {
        let costumeStr = Clr[color] + Kind[kind];
        newInner = `<img src="images/${costumeStr}.png">`;
    }
    square.innerHTML = newInner;
}

function updateView(aState: StateType, changedLocations: Position[]) {
    let info = aState.spriteStateInfo;
    let board = aState.squareSprites;
    for (const pos of changedLocations) {
        let sprite = getStateSpriteId(aState, pos);
        if (sprite) {
            updateViewAtLocation(pos, getSpriteColor(sprite), info[sprite].kind);
        } else {
            updateViewAtLocation(pos, null, Kind.P);
        }
    }
}

function isPromotion(aState: StateType, turn: Turn) : boolean {
    let { primary: {from: fpos, to: tpos}, secondary: s} : Turn = turn;
    let sprite = getStateSpriteId(aState, fpos);
    let oldInfo = aState.spriteStateInfo[sprite];
    let oldKind = oldInfo.kind;
    let oldColor = getSpriteColor(sprite);
    let promoRank = (oldColor == Clr.w) ? 7 : 0;
    return (oldKind == Kind.P) && (tpos[1] == promoRank);
}

function pos2algebraic([file, rank]:Position) : string {
    let fileStr = "abcdefgh"[file];
    let rankStr = "12345678"[rank];
    return fileStr + rankStr;
}

// Produce string representation of a turn in standard
// chess notation (maybe somewhat verbose).
function turn2notation(aState:StateType, turn: Turn) : string {
    let {primary: {from: from, to: to}, secondary: sec}: Turn = turn;
    let info = aState.spriteStateInfo;

    // Primary sprite
    let psprite: SpriteId = getStateSpriteId(aState, from);
    let pspriteInfo = info[psprite];
    let pkind: Kind = pspriteInfo.kind;
    if (pkind == Kind.K) {
        // Might be castling.
        let dx = to[0]-from[0];
        if (Math.abs(dx) == 2) {
            // It is castling.
            if (dx > 0) {
                return "O-O"; // King Side
            } else {
                return "O-O-O"; // Queen Side
            }
        }
    }
    let part1 = Kind[pkind]+pos2algebraic(from);
    let destPart = pos2algebraic(to);
    let middlePart: string;
    if (sec) {
        // Capture piece. We already covered castling above which is the
        // only non-capture case of secondary sprite.
        let {from: sfrom, to: sto}: Move = sec;
        let ssprite: SpriteId = getStateSpriteId(aState, sfrom);
        let sspriteInfo = info[ssprite];
        let skind: Kind = sspriteInfo.kind;
        middlePart = `x${Kind[skind]}`;
        // With ordinary capture the sfrom == to. It that is not the
        // case it is en passant.
        if (!posEq(to, sfrom)) {
            middlePart += " e.p."
        }
    } else {
        middlePart = "-"
    }
    return part1 + middlePart + destPart;
}

function moveTurn(turn: Turn) {
    let promoKind : Kind | null = null;
    if (isPromotion(state, turn)) {
        // Pawn promotion.
        promoKind = getPromotionKind();
    }
    let [newState, changedLocations] = stateAfterMove(turn, state, promoKind);
    updateView(newState, changedLocations);

    // Interpret move in old state.
    let turnStr = turn2notation(state, turn);
    console.log(turnStr);
    state = newState;
    states.push(state);
}

function findInArray<T>(ray: T[], pred: (T) => boolean) : T | null {
    for (const item of ray) {
        if (pred(item)) {
            return item;
        }
    }
    return null;
}

function legalMove(sprite: SpriteId, pos: Position) {
    myAssert(sprite > 0, "legalMove: no sprite");
    let spriteStateInfo = state.spriteStateInfo[sprite];
    let oldLoc = spriteStateInfo.position;
    myAssert(sprite == spriteStateInfo.index, "LegalMove: Inconsistent index");
    let color = getSpriteColor(sprite);
    myAssert(color == state.whoseMove, "LegalMove: It is not the turn of that piece");
    let okMoves = potentialMoves(false, false, oldLoc, state);
    let turnPred = (turn: Turn) => {
        return posEq(turn.primary.to, pos);
    }
    let turn : Turn | null = findInArray(okMoves, turnPred);
    myAssert(Boolean(turn), "Location is not in the potential moves.");
    if (turn) {
        moveTurn(turn);
    }
    selectedSprite = SpriteId.None;
}

function doClick(file: number, rank: number) {
    try {
        let pos: Position = [file, rank];

        let sprite = getStateSpriteId(state, pos);
        if (sprite) {
            if (selectedSprite) {
                if (selectedSprite == sprite) {
                    throw "You cannot move to the location you are already on.";
                } else if (getSpriteColor(selectedSprite) == getSpriteColor(sprite)) {
                    throw "You can't move to a space with your own piece";
                } else {
                       legalMove(selectedSprite, pos);
                }
            } else {
                // No sprite selected.
                selectedSprite = sprite;
            }
        }else {
            // No sprite at the clicked spot.
            if (selectedSprite) {
                legalMove(selectedSprite, pos);
            } else {
                throw "Click a location with a piece to move."
            }
        }
    } catch (error) {
        alert(`Got error=${error}, deselecting.`)
        selectedSprite = SpriteId.None;
    }
}
