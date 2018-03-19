@import 'common.js'


// MARK: Rename
function rename(context) {
    var doc = context.document
    var selection = context.selection
    var selectionCount = selection.count()
    if (selectionCount > 0) {
        var alert = createDialog("Rename", "Number: %N (From Bottom) or %n (From Top)\nOriginal Name: ^", "Name:", "", "Starts Number From:", "1")
        var options = handleAlertResponse_rename(alert,alert.runModal())
        
        // Ensure it is a number
        if (!options.startsFrom) {options.startsFrom = 1}
        
        // Layer
        for (var i = 0; i < selectionCount; i++) {
            var layer = selection[i]
            var name = newName(layer.name(), i, selectionCount, options.inputName, options.startsFrom)
            layer.setName(name)
        }
        
        var unit = (selectionCount > 1) ? " layers'" : " layer's"
        doc.showMessage(selectionCount + unit + " name updated")
    } else {
        showAlert("Fail to rename", "You need to select at least one layer")
    }
}
function handleAlertResponse_rename(alert, responseCode) {
    if (responseCode == "1000") {
        return {
        inputName: alert.viewAtIndex(1).stringValue(),
        startsFrom: numberAtIndex(alert,3)
        }
    }
    return nil
}
function newName(layerName, currentIndex, selectionCount, inputName, startsFrom) {
    /* 
     RegExp: /pattern/modifiers
     i -> case insensitive
     g -> all places
     + -> at least one
     \ -> toggle special character || normal literal
    */
    var newLayerName = inputName
    
    function replaceNumber(match) {
        var letter = match.charAt(1)
        var num	= (letter == "N") ? currentIndex : selectionCount - currentIndex - 1
        num += startsFrom
        return num.toString()
    }
    
    newLayerName = newLayerName.replace(/\%N/ig, replaceNumber)
    newLayerName = newLayerName.replace(/\^/g, layerName)
    return newLayerName
}

// MARK: Replace Text
function findReplace(context) {
    var doc = context.document
    var selection = context.selection
    var selectionCount = selection.count()
    if (selectionCount > 0) {
        var alert = createDialog("Replace Text", "Find and replace text of selected layer's name\n*CASE SENSITIVE*", "Find:", "", "Replace with:", "")
        var options = handleAlertResponse_findReplace(alert, alert.runModal())
        
        // Layer
        for (var i = 0; i < selectionCount; i++) {
            var layer = selection[i]
            var name = nameWithReplacedText(layer.name(), options.findText, options.replaceWith)
            layer.setName(name)
        }
        
        var unit = (selectionCount > 1) ? " layers'" : " layer's"
        doc.showMessage(selectionCount + unit + " name updated")
    } else {
        showAlert("Fail to replace text", "You need to select at least one layer")
    }
}
function handleAlertResponse_findReplace(alert, responseCode) {
    if (responseCode == "1000") {
        return {
        findText: alert.viewAtIndex(1).stringValue(),
        replaceWith: alert.viewAtIndex(3).stringValue()
        }
    }
    return nil
}
function nameWithReplacedText(layerName, findText, replaceWith) {
    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
    var reg = new RegExp(escapeRegExp(findText), "g")
    return layerName.replace(reg, replaceWith)
}

