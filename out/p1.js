"use strict";
// Create a map from enum keys to key names.
// This is handier for iterating.
function enumMap(e) {
    let result = new Map();
    for (const key in e) {
        if (Object.prototype.hasOwnProperty.call(e, key)) {
            const element = e[key];
            if (typeof element == "number") {
                result.set(element, key);
            }
        }
    }
    return result;
}
// -------------------------- Types -----------------------
var Clr;
(function (Clr) {
    Clr[Clr["w"] = 0] = "w";
    Clr[Clr["b"] = 1] = "b";
})(Clr || (Clr = {}));
var clrMap = enumMap(Clr);
var Kind;
(function (Kind) {
    Kind[Kind["K"] = 0] = "K";
    Kind[Kind["Q"] = 1] = "Q";
    Kind[Kind["R"] = 2] = "R";
    Kind[Kind["B"] = 3] = "B";
    Kind[Kind["N"] = 4] = "N";
    Kind[Kind["P"] = 5] = "P";
})(Kind || (Kind = {}));
var kindMap = enumMap(Kind);
var SpriteId;
(function (SpriteId) {
    SpriteId[SpriteId["None"] = 0] = "None";
    SpriteId[SpriteId["wR1"] = 1] = "wR1";
    SpriteId[SpriteId["wN2"] = 2] = "wN2";
    SpriteId[SpriteId["wB3"] = 3] = "wB3";
    SpriteId[SpriteId["wQ4"] = 4] = "wQ4";
    SpriteId[SpriteId["wK5"] = 5] = "wK5";
    SpriteId[SpriteId["wB6"] = 6] = "wB6";
    SpriteId[SpriteId["wN7"] = 7] = "wN7";
    SpriteId[SpriteId["wR8"] = 8] = "wR8";
    SpriteId[SpriteId["wP1"] = 9] = "wP1";
    SpriteId[SpriteId["wP2"] = 10] = "wP2";
    SpriteId[SpriteId["wP3"] = 11] = "wP3";
    SpriteId[SpriteId["wP4"] = 12] = "wP4";
    SpriteId[SpriteId["wP5"] = 13] = "wP5";
    SpriteId[SpriteId["wP6"] = 14] = "wP6";
    SpriteId[SpriteId["wP7"] = 15] = "wP7";
    SpriteId[SpriteId["wP8"] = 16] = "wP8";
    SpriteId[SpriteId["bR1"] = 17] = "bR1";
    SpriteId[SpriteId["bN2"] = 18] = "bN2";
    SpriteId[SpriteId["bB3"] = 19] = "bB3";
    SpriteId[SpriteId["bQ4"] = 20] = "bQ4";
    SpriteId[SpriteId["bK5"] = 21] = "bK5";
    SpriteId[SpriteId["bB6"] = 22] = "bB6";
    SpriteId[SpriteId["bN7"] = 23] = "bN7";
    SpriteId[SpriteId["bR8"] = 24] = "bR8";
    SpriteId[SpriteId["bP1"] = 25] = "bP1";
    SpriteId[SpriteId["bP2"] = 26] = "bP2";
    SpriteId[SpriteId["bP3"] = 27] = "bP3";
    SpriteId[SpriteId["bP4"] = 28] = "bP4";
    SpriteId[SpriteId["bP5"] = 29] = "bP5";
    SpriteId[SpriteId["bP6"] = 30] = "bP6";
    SpriteId[SpriteId["bP7"] = 31] = "bP7";
    SpriteId[SpriteId["bP8"] = 32] = "bP8";
})(SpriteId || (SpriteId = {}));
var spriteIdMap = enumMap(SpriteId);
// -------------------------- Global Variables -----------------------
// spriteInfo[spriteId] gives the constant information for a sprite.
var spriteInfo = [];
var view = {
    squareElements: [],
};
// The current state.
var state = {
    moveNumber: 1,
    whoseMove: Clr.w,
    squareSprites: [],
    spriteStateInfo: [],
    enPassantPosition: null,
    enPassantPawn: SpriteId.None,
    haveMoved: makeArray(32, false)
};
// A record of all states.
var states = [];
var selectedSprite = 0;
// -------------------------- Functions -----------------------
function getSpriteInfo(id) {
    return spriteInfo[id];
}
function makeSprites() {
    for (const [idIndex, idText] of spriteIdMap) {
        if (idIndex == 0) {
            // The None sprite.
            let noSprite = {
                index: idIndex,
                name: idText,
                color: Clr.w,
                kind: Kind.P,
                originalPosition: [0, -1]
            };
            spriteInfo.push(noSprite);
        }
        else {
            let file = Number(idText.substring(2, 3)) - 1;
            let kindText = idText.substring(1, 2);
            let kind = Kind[kindText];
            let colorText = idText.substring(0, 1);
            let color = Clr[colorText];
            let rank = (kind == Kind.P ? 1 : 0);
            if (color == Clr.b) {
                rank = 7 - rank;
            }
            let sprite = {
                index: idIndex,
                name: idText,
                color: color,
                kind: kind,
                originalPosition: [file, rank],
            };
            spriteInfo.push(sprite);
        }
    }
}
function rank2boardRow(r) {
    return 9 - r;
}
function boardRow2rank(b) {
    return 9 - b;
}
// Shallow copy of array.
function shallowArrayCopy(ray) {
    return [...ray];
}
function matrixCopy(m) {
    let result = [];
    m.forEach(row => {
        result.push([...row]);
    });
    return result;
}
// Functional update that does not modify the input matrix.
function updateMatrix(m, [modFile, modRow], value) {
    let result = [];
    for (let mrow = 0; mrow < m.length; mrow++) {
        const row = m[mrow];
        if (mrow == modRow) {
            // This is the row we are modifying.
            let newRow = [];
            for (let mfile = 0; mfile < row.length; mfile++) {
                const element = row[mfile];
                if (mfile == modFile) {
                    // The file being modified.
                    newRow.push(value);
                }
                else {
                    newRow.push(element);
                }
            }
            result.push(newRow);
        }
        else {
            // An unmodified row.
            result.push(row);
        }
    }
    return result;
}
function updateBoard(board, [file, rank], value) {
    return updateMatrix(board, [file, rank2boardRow(rank)], value);
}
function makeArray(n, val) {
    let result = [];
    for (let index = 0; index < n; index++) {
        result.push(val);
    }
    return result;
}
// Functions to create HTML for the user interface.
function makeHeaderRow(data) {
    let tr = document.createElement("tr");
    data.forEach(element => {
        let th = document.createElement("th");
        th.innerHTML = element;
        tr.appendChild(th);
    });
    return tr;
}
function makeCapturedRow(rank) {
    let tr = document.createElement("tr");
    tr.appendChild(document.createElement("td"));
    let elms = [];
    for (let file = 0; file < 8; file++) {
        let td = document.createElement("td");
        let ida = document.createAttribute("id");
        ida.value = `square${file}${rank}`;
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
function makeRegularRow(rank) {
    let tr = document.createElement("tr");
    let tdCaption = document.createElement("td");
    tdCaption.innerText = `${rank + 1}`;
    tr.appendChild(tdCaption);
    let elms = [];
    for (let file = 0; file < 8; file++) {
        let td = document.createElement("td");
        let ida = document.createAttribute("id");
        ida.value = `square${file}${rank}`;
        td.setAttributeNode(ida);
        let classAttr = document.createAttribute("class");
        classAttr.value = ((file + rank) % 2 == 0 ? "black" : "white");
        td.setAttributeNode(classAttr);
        let onclickAttr = document.createAttribute("onclick");
        onclickAttr.value = `doClick(${file},${rank})`;
        td.setAttributeNode(onclickAttr);
        tr.appendChild(td);
        elms.push(td);
    }
    view.squareElements.push(elms);
    tdCaption = document.createElement("td");
    tdCaption.innerText = `${rank + 1}`;
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
    atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeCapturedRow(9));
    atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeCapturedRow(8));
    atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeHeaderRow(["", "A", "B", "C", "D", "E", "F", "G", "H", ""]));
    for (let rank = 7; rank >= 0; rank--) {
        atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeRegularRow(rank));
    }
    atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeHeaderRow(["", "A", "B", "C", "D", "E", "F", "G", "H", ""]));
    atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeCapturedRow(-1));
    atbody === null || atbody === void 0 ? void 0 : atbody.appendChild(makeCapturedRow(-2));
}
function getViewSquare(pos) {
    let [file, rank] = pos;
    return view.squareElements[rank2boardRow(rank)][file];
}
function getOriginalSpriteKind(sprite) {
    return spriteInfo[sprite].kind;
}
function getStateSpriteId(aState, pos) {
    let [file, rank] = pos;
    return aState.squareSprites[rank2boardRow(rank)][file];
}
function setStateSpriteId(aState, pos, spriteNum) {
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
    let infos = [];
    spriteInfo.forEach(spriteInfo => {
        let sprite = spriteInfo.index;
        let loc = spriteInfo.originalPosition;
        setStateSpriteId(state, loc, sprite);
        let stateSpriteInfo = {
            index: sprite,
            kind: spriteInfo.kind,
            position: loc
        };
        infos.push(stateSpriteInfo);
    });
    state.spriteStateInfo = infos;
    states.push(state);
}
function myLoaded() {
    console.log("Main page loaded");
    initializeView();
    makeSprites();
    resetView();
    initializeState();
}
function outOfRange(arg) {
    if (typeof arg == "number") {
        return (arg < 0) || (arg > 7);
    }
    else {
        for (let index = 0; index < arg.length; index++) {
            const element = arg[index];
            if (outOfRange(element)) {
                return true;
            }
        }
    }
    return false;
}
function myAssert(condition, message) {
    if (!condition) {
        throw message;
    }
}
function getSpriteColor(index) {
    myAssert(index > 0, "Invalid sprite number");
    return spriteInfo[index].color;
}
function posAssign([file, rank]) {
    return [file, rank];
}
function posAbs([file, rank]) {
    return [Math.abs(file), Math.abs(rank)];
}
function posAdd([f1, r1], [f2, r2]) {
    return [f1 + f2, r1 + r2];
}
function posScalarMult(scalar, [f1, r1]) {
    return [scalar * f1, scalar * r1];
}
function posScalarDiv([f1, r1], scalar) {
    return [f1 / scalar, r1 / scalar];
}
function posEq([f1, r1], [f2, r2]) {
    return (f1 == f2) && (r1 == r2);
}
// Returns potential moves and id of captured Pawn, if any]
function pawnmoves(sprite, defence, captureOnly, loc, aState) {
    let result = [];
    let capturedPawn = SpriteId.None;
    let [file, rank] = loc;
    let myColor = getSpriteColor(sprite);
    myAssert(!captureOnly || defence, "If captureOnly, defense must be on!");
    let pawnDiry;
    let startRank;
    if (myColor == Clr.w) {
        pawnDiry = 1;
        startRank = 1;
    }
    else {
        pawnDiry = -1;
        startRank = 6;
    }
    let enPassant = aState.enPassantPosition;
    let dirs = [[0, pawnDiry], [1, pawnDiry], [-1, pawnDiry]];
    for (const dir of dirs) {
        let dx = dir[0];
        for (let i = 1; i <= 2; i++) {
            if ((i == 2) && ((dx != 0) || (rank != startRank))) {
                break;
            }
            let dest = posAdd(loc, posScalarMult(i, dir));
            let pmove = { from: [...loc], to: dest };
            if (outOfRange(dest)) {
                break;
            }
            let destSprite = getStateSpriteId(aState, dest);
            if (destSprite) {
                let destColor = getSpriteColor(destSprite);
                if (dx != 0) {
                    if (destColor == myColor) {
                        if (defence) {
                            let turn = { primary: pmove, secondary: null };
                            result.push(turn);
                        }
                    }
                    else {
                        let capLoc = capturedLocation(destSprite);
                        let capMove = { from: dest, to: capLoc };
                        let turn = { primary: pmove, secondary: capMove };
                        result.push(turn); // Capture
                    }
                }
                else {
                    // Going straight and a piece in the way.
                }
                break; // Cannot move past a piece.
            }
            else {
                // No piece at destination.
                if (dx == 0) {
                    if (!captureOnly) {
                        let turn = { primary: pmove, secondary: null };
                        result.push(turn);
                    }
                }
                else {
                    if (enPassant && posEq(dest, enPassant)) {
                        let enpSprite = state.enPassantPawn;
                        let enpLoc = state.spriteStateInfo[enpSprite].position;
                        let capLoc = capturedLocation(enpSprite);
                        let enpMove = { from: enpLoc, to: capLoc };
                        let turn = { primary: pmove, secondary: enpMove };
                        result.push(turn);
                        capturedPawn = aState.enPassantPawn;
                    }
                }
            }
        }
    }
    return result;
}
function underAttack(aState, pos) {
    // TODO
    return false;
}
function castleOK(aState, kingSide) {
    let color = aState.whoseMove;
    let r1 = color == Clr.w ? SpriteId.wR1 : SpriteId.bR1;
    let r8 = color == Clr.w ? SpriteId.wR8 : SpriteId.bR8;
    let k = color == Clr.w ? SpriteId.wK5 : SpriteId.bK5;
    let rank = color == Clr.w ? 0 : 7;
    let intervening = kingSide ?
        [[5, rank], [6, rank]] :
        [[1, rank], [2, rank], [3, rank]];
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
function majorPieceMoves(sprite, defence, loc, aState) {
    let result = [];
    let [file, rank] = loc;
    let myColor = getSpriteColor(sprite);
    let myKind = aState.spriteStateInfo[sprite].kind;
    let kstr = kindMap.get(myKind);
    let dirs = [];
    if (myKind == Kind.N) {
        dirs = [[2, 1], [1, 2], [-1, 2], [-2, 1],
            [-2, -1], [-1, -2], [1, -2], [2, -1]];
    }
    else {
        if ("BQK".indexOf(kstr) >= 0) {
            dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        }
        if ("RQK".indexOf(kstr) >= 0) {
            dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
        }
    }
    for (const dir of dirs) {
        for (let i = 1; i <= 8; i++) {
            if (("NK".indexOf(kstr) >= 0) && (i > 1)) {
                break;
            }
            let dest = posAdd(loc, posScalarMult(i, dir));
            if (outOfRange(dest)) {
                break;
            }
            let pmove = { from: [...loc], to: dest };
            let destSprite = getStateSpriteId(aState, dest);
            if (destSprite) {
                let destColor = getSpriteColor(destSprite);
                if (destColor == myColor) {
                    if (defence) {
                        let turn = { primary: pmove, secondary: null };
                        result.push(turn);
                    }
                }
                else {
                    let capLoc = capturedLocation(destSprite);
                    let capMove = { from: dest, to: capLoc };
                    let turn = { primary: pmove, secondary: capMove };
                    result.push(turn); // Capture
                }
                break; // Cannot move past a piece.
            }
            else {
                // No piece at destination.
                let turn = { primary: pmove, secondary: null };
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
                let dest = posAdd(loc, [kdx, 0]);
                let rstart = [rstartx, rank];
                let rend = [rstartx + rdx, rank];
                let kmove = { from: loc, to: dest };
                let rmove = { from: rstart, to: rend };
                let turn = { primary: kmove, secondary: rmove };
                result.push(turn);
            }
        }
    }
    return result;
}
function potentialMoves(defence, captureOnly, loc, aState) {
    let sprite = getStateSpriteId(aState, loc);
    myAssert(Boolean(sprite), "Error in potentialMoves:There's no sprite here!");
    let kind = aState.spriteStateInfo[sprite].kind;
    if (kind == Kind.P) {
        return pawnmoves(sprite, defence, captureOnly, loc, aState);
    }
    else {
        return majorPieceMoves(sprite, defence, loc, aState);
    }
}
// Compute the location to display a captured piece.
function capturedLocation(sprite) {
    let info = spriteInfo[sprite];
    let origLoc = info.originalPosition;
    let color = info.color;
    let dy = (color == Clr.w) ? 8 : -8;
    let capLoc = posAdd(origLoc, [0, dy]);
    return capLoc;
}
function getPromotionKind() {
    // Pawn promotion.
    let newKindStr = "x";
    while ("QRBN".indexOf(newKindStr) == -1) {
        newKindStr = prompt("What do you want the pawn to be (QRBN)?", "Q") || "";
        myAssert(newKindStr != null, "No promotion option chosen");
    }
    let newKind = Kind[newKindStr];
    return newKind;
}
// Returns the new state and the list of positions that have changed.
function stateAfterMove(turn, fromState, promoKind) {
    // Process the secondary first, so we do not wipe out its
    // information when the primary captures it.
    let secondary = turn.secondary;
    let newBoard0 = fromState.squareSprites;
    let newBoard2 = newBoard0;
    let changedPositions = [];
    let sinfo = [...fromState.spriteStateInfo];
    let newHaveMoved = [...fromState.haveMoved];
    if (secondary) {
        let { from: sfrom, to: sto } = secondary;
        let capturedOther = getStateSpriteId(fromState, sfrom);
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
        };
        sinfo[capturedOther] = newsInfo;
        newHaveMoved[capturedOther] = true;
    }
    let { from: oldLoc, to: pos } = turn.primary;
    let sprite = getStateSpriteId(fromState, oldLoc);
    let oldInfo = sinfo[sprite];
    changedPositions.push(oldLoc, pos);
    let oldKind = oldInfo.kind;
    let newKind = promoKind || oldKind;
    let newInfo = {
        index: sprite,
        kind: newKind,
        position: pos
    };
    sinfo[sprite] = newInfo;
    // First erase from old location.
    let newBoard3 = updateBoard(newBoard2, oldLoc, SpriteId.None);
    // Now record in new location.
    let newBoard4 = updateBoard(newBoard3, pos, sprite);
    let newMove = (fromState.whoseMove == Clr.b) ? fromState.moveNumber + 1 : fromState.moveNumber;
    let newWhose = Clr.b - fromState.whoseMove;
    let newEnPassantPosition = null;
    let newEnPassantSprite = SpriteId.None;
    if ((oldKind == Kind.P)) {
        let dloc = posAdd(pos, posScalarMult(-1, oldLoc));
        let origLoc = spriteInfo[sprite].originalPosition;
        if (posEq(origLoc, oldLoc) && posEq(posAbs(dloc), [0, 2])) {
            newEnPassantSprite = sprite;
            newEnPassantPosition = posAdd(oldLoc, posScalarDiv(dloc, 2));
        }
    }
    newHaveMoved[sprite] = true;
    let newState = {
        moveNumber: newMove,
        whoseMove: newWhose,
        squareSprites: newBoard4,
        spriteStateInfo: sinfo,
        enPassantPosition: newEnPassantPosition,
        enPassantPawn: newEnPassantSprite,
        haveMoved: newHaveMoved
    };
    return [newState, changedPositions];
}
function updateViewAtLocation(pos, color, kind) {
    let square = getViewSquare(pos);
    let newInner = "";
    if (color != null) {
        let costumeStr = Clr[color] + Kind[kind];
        newInner = `<img src="images/${costumeStr}.png">`;
    }
    square.innerHTML = newInner;
}
function updateView(aState, changedLocations) {
    let info = aState.spriteStateInfo;
    let board = aState.squareSprites;
    for (const pos of changedLocations) {
        let sprite = getStateSpriteId(aState, pos);
        if (sprite) {
            updateViewAtLocation(pos, getSpriteColor(sprite), info[sprite].kind);
        }
        else {
            updateViewAtLocation(pos, null, Kind.P);
        }
    }
}
function isPromotion(aState, turn) {
    let { primary: { from: fpos, to: tpos }, secondary: s } = turn;
    let sprite = getStateSpriteId(aState, fpos);
    let oldInfo = aState.spriteStateInfo[sprite];
    let oldKind = oldInfo.kind;
    let oldColor = getSpriteColor(sprite);
    let promoRank = (oldColor == Clr.w) ? 7 : 0;
    return (oldKind == Kind.P) && (tpos[1] == promoRank);
}
function pos2algebraic([file, rank]) {
    let fileStr = "abcdefgh"[file];
    let rankStr = "12345678"[rank];
    return fileStr + rankStr;
}
// Produce string representation of a turn in standard
// chess notation (maybe somewhat verbose).
function turn2notation(aState, turn) {
    let { primary: { from: from, to: to }, secondary: sec } = turn;
    let info = aState.spriteStateInfo;
    // Primary sprite
    let psprite = getStateSpriteId(aState, from);
    let pspriteInfo = info[psprite];
    let pkind = pspriteInfo.kind;
    if (pkind == Kind.K) {
        // Might be castling.
        let dx = to[0] - from[0];
        if (Math.abs(dx) == 2) {
            // It is castling.
            if (dx > 0) {
                return "O-O"; // King Side
            }
            else {
                return "O-O-O"; // Queen Side
            }
        }
    }
    let part1 = Kind[pkind] + pos2algebraic(from);
    let destPart = pos2algebraic(to);
    let middlePart;
    if (sec) {
        // Capture piece. We already covered castling above which is the
        // only non-capture case of secondary sprite.
        let { from: sfrom, to: sto } = sec;
        let ssprite = getStateSpriteId(aState, sfrom);
        let sspriteInfo = info[ssprite];
        let skind = sspriteInfo.kind;
        middlePart = `x${Kind[skind]}`;
        // With ordinary capture the sfrom == to. It that is not the
        // case it is en passant.
        if (!posEq(to, sfrom)) {
            middlePart += " e.p.";
        }
    }
    else {
        middlePart = "-";
    }
    return part1 + middlePart + destPart;
}
function moveTurn(turn) {
    let promoKind = null;
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
function findInArray(ray, pred) {
    for (const item of ray) {
        if (pred(item)) {
            return item;
        }
    }
    return null;
}
function legalMove(sprite, pos) {
    myAssert(sprite > 0, "legalMove: no sprite");
    let spriteStateInfo = state.spriteStateInfo[sprite];
    let oldLoc = spriteStateInfo.position;
    myAssert(sprite == spriteStateInfo.index, "LegalMove: Inconsistent index");
    let color = getSpriteColor(sprite);
    myAssert(color == state.whoseMove, "LegalMove: It is not the turn of that piece");
    let okMoves = potentialMoves(false, false, oldLoc, state);
    let turnPred = (turn) => {
        return posEq(turn.primary.to, pos);
    };
    let turn = findInArray(okMoves, turnPred);
    myAssert(Boolean(turn), "Location is not in the potential moves.");
    if (turn) {
        moveTurn(turn);
    }
    selectedSprite = SpriteId.None;
}
function doClick(file, rank) {
    try {
        let pos = [file, rank];
        let sprite = getStateSpriteId(state, pos);
        if (sprite) {
            if (selectedSprite) {
                if (selectedSprite == sprite) {
                    throw "You cannot move to the location you are already on.";
                }
                else if (getSpriteColor(selectedSprite) == getSpriteColor(sprite)) {
                    throw "You can't move to a space with your own piece";
                }
                else {
                    legalMove(selectedSprite, pos);
                }
            }
            else {
                // No sprite selected.
                selectedSprite = sprite;
            }
        }
        else {
            // No sprite at the clicked spot.
            if (selectedSprite) {
                legalMove(selectedSprite, pos);
            }
            else {
                throw "Click a location with a piece to move.";
            }
        }
    }
    catch (error) {
        alert(`Got error=${error}, deselecting.`);
        selectedSprite = SpriteId.None;
    }
}
//# sourceMappingURL=p1.js.map