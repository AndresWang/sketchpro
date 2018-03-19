// MARK: Sketch Functions
var sketchAction = {
    sendAction: function(commandToPerform, doc) {
        try {
            [NSApp sendAction:commandToPerform to:nil from:doc]
        } catch(e) {
            log(e)
        }
    },
    deleteAction: function(doc) {
        sketchAction.sendAction("delete:", doc)
    },
    selectAllArtboards: function(doc) {
        sketchAction.sendAction("selectAllArtboards:", doc)
    },
    alignLayersLeft: function(doc) {
        sketchAction.sendAction("alignLayersLeft:", doc)
    },
    alignLayersCenter: function(doc) {
        sketchAction.sendAction("alignLayersCenter:", doc)
    },
    alignLayersRight: function(doc) {
        sketchAction.sendAction("alignLayersRight:", doc)
    },
    moveToBack: function(doc) {
        sketchAction.sendAction("moveToBack:", doc)
    },
    group: function(doc) {
        sketchAction.sendAction("group:", doc)
    },
    ungroup: function(doc) {
        sketchAction.sendAction("ungroup:", doc)
    },
    duplicate: function(doc) {
        sketchAction.sendAction("duplicate:", doc)
    },
    copy: function(doc) {
        sketchAction.sendAction("copy:", doc)
    },
    paste: function(doc) {
        sketchAction.sendAction("paste:", doc)
    },
    centerSelection: function(doc) {
        sketchAction.sendAction("centerSelectionInVisibleArea:", doc)
    }
}
function resizeCurrentArtboard(doc) {
    doc.actionsController().actionForID("MSResizeArtboardToFitAction").resizeArtboardToFit(nil)
}
function collapseArtboardsAndGroups(doc) {
    doc.currentPage().changeSelectionBySelectingLayers(nil)
    var action = doc.actionsController().actionForID("MSCollapseAllGroupsAction")
    if (action.validate()) {
        action.doPerformAction(nil)
    } else {
        log("Failed to perform MSCollapseAllGroupsAction: invalid action ID.")
    }
}

// MARK: File operation
function writeTextToFile(text, filePath) {
    var t = [NSString stringWithFormat:@"%@", text],
    f = [NSString stringWithFormat:@"%@", filePath]
    return [t writeToFile:f atomically:true encoding:NSUTF8StringEncoding error:nil]
}
function readTextFromFile(filePath) {
    var fileManager = [NSFileManager defaultManager]
    if([fileManager fileExistsAtPath:filePath]) {
        return [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:nil]
    }
    return nil
}
function createTempFolderNamed(name) {
    var tempPath = getTempFolderPath(name)
    createFolderAtPath(tempPath)
    return tempPath
}
function getTempFolderPath(withName) {
    var fileManager = [NSFileManager defaultManager],
    cachesURL = [[fileManager URLsForDirectory:NSCachesDirectory inDomains:NSUserDomainMask] lastObject],
    withName = (typeof withName !== 'undefined') ? withName : (Date.now() / 1000),
    folderName = [NSString stringWithFormat:"%@", withName]
    return [[cachesURL URLByAppendingPathComponent:folderName] path]
}
function createFolderAtPath(pathString) {
    var fileManager = [NSFileManager defaultManager]
    if([fileManager fileExistsAtPath:pathString]) return true
        return [fileManager createDirectoryAtPath:pathString withIntermediateDirectories:true attributes:nil error:nil]
        }

// MARK: Json
function jsonFromFile(filePath, mutable) {
    var data = [NSData dataWithContentsOfFile:filePath]
    var options = mutable == true ? NSJSONReadingMutableContainers : 0
    return [NSJSONSerialization JSONObjectWithData:data options:options error:nil]
}
function saveJsonToFile(jsonObj, filePath) {
    writeTextToFile(stringify(jsonObj), filePath)
}
function stringify(obj, prettyPrinted) {
    var prettySetting = prettyPrinted ? NSJSONWritingPrettyPrinted : 0,
    jsonData = [NSJSONSerialization dataWithJSONObject:obj options:prettySetting error:nil]
    return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding]
}

// MARK: Window
function createDialog(title, description, firstlabel, firstValue, secondlabel, secondValue) {
    var alert = COSAlertWindow.new()
    
    // Title
    alert.setMessageText(title)
    
    // Description (Optional)
    if (description != nil) {alert.setInformativeText(description)}
    
    // First field
    createTextFieldWithLabel(alert, firstlabel, firstValue)
    var firstField = alert.viewAtIndex(1)
    alert.alert().window().setInitialFirstResponder(firstField)
    
    // Second field (Optional)
    if (secondlabel != nil) {
        createTextFieldWithLabel(alert, secondlabel, secondValue)
        var secondField = alert.viewAtIndex(3)
        firstField.setNextKeyView(secondField)
    }
    
    // Actions buttons
    alert.addButtonWithTitle("OK")
    alert.addButtonWithTitle("Cancel")
    
    return alert
}
function createTextFieldWithLabel(alert, label, defaultValue) {
    alert.addTextLabelWithValue(label)
    alert.addTextFieldWithValue(defaultValue)
}
function numberAtIndex (view, index) {
    return parseInt(view.viewAtIndex(index).stringValue())
}
function createDropdown(msg, items, selectedItemIndex) {
    selectedItemIndex = selectedItemIndex || 0
    
    var accessory = [[NSComboBox alloc] initWithFrame:NSMakeRect(0,0,200,25)]
    [accessory setEditable:false]
    [accessory addItemsWithObjectValues:items]
    [accessory selectItemAtIndex:selectedItemIndex]
    
    var alert = [[NSAlert alloc] init]
    [alert setMessageText:msg]
    [alert addButtonWithTitle:"OK"]
    [alert addButtonWithTitle:"Cancel"]
    [alert setAccessoryView:accessory]
    
    var responseCode = [alert runModal]
    var index = [accessory indexOfSelectedItem]
    
    return {responseCode: responseCode, index: index}
}

// MARK: Create Layers
function createArtboard(config, insertIndex) {
    var artboard = MSArtboardGroup.new()
    
    if (insertIndex == nil) {
        config.parent.addLayers([artboard])
    } else {
        config.parent.insertLayer_atIndex(artboard, insertIndex)
    }
    
    artboard.setName(config.name)
    artboard.frame().x = config.x
    artboard.frame().y = config.y
    artboard.frame().width = config.width
    artboard.frame().height = config.height
    artboard.setConstrainProportions(false)
    return artboard
}
function createGroup(config) {
    var group = MSLayerGroup.new()
    config.parent.addLayers([group])
    
    group.setName(config.name)
    return group
}
function createRectangle(config) {
    var rectangle = MSRectangleShape.new()
    rectangle.setName(config.name)
    rectangle.frame().setX(config.x)
    rectangle.frame().setY(config.y)
    rectangle.frame().setWidth(config.width)
    rectangle.frame().setHeight(config.height)
    
    var shape = MSShapeGroup.shapeWithPath(rectangle)
    config.parent.addLayers([shape])
    return shape
}
function createText(config) {
    var text = MSTextLayer.new()
    config.parent.addLayers([text])
    
    text.setName(config.name)
    text.setStringValue(config.string)
    text.setFontPostscriptName(config.fontPostscriptName)
    text.setTextColor(config.textColor)
    text.setFontSize(config.fontSize)
    text.frame().setX(config.x)
    text.frame().setY(config.y)
    return text
}

// MARK: Misc.
// Search in all pages if pagePredicate is nil
function searchLayersInsideArtboards(doc, pagePredicate, layerPredicate) {
    var pages = doc.pages()
    if (pagePredicate != nil) {pages = pages.filteredArrayUsingPredicate(pagePredicate)}
    var results = NSArray.array()
    
    for (var i = 0; i < pages.count(); i++) {
        var artboards = pages[i].artboards()
        var scope = NSArray.array()
        for (var j = 0; j < artboards.length; j++) {
            scope = scope.arrayByAddingObjectsFromArray(artboards[j].children())
        }
        results = results.arrayByAddingObjectsFromArray(scope.filteredArrayUsingPredicate(layerPredicate))
    }
    return results
}
// Search in all pages if pagePredicate is nil
function searchArtboards(doc, pagePredicate, artboardPredicate) {
    var pages = doc.pages()
    if (pagePredicate != nil) {pages = pages.filteredArrayUsingPredicate(pagePredicate)}
    var results = NSArray.array()
    
    for (var i = 0; i < pages.count(); i++) {
        var artboards = pages[i].artboards()
        results = results.arrayByAddingObjectsFromArray(artboards.filteredArrayUsingPredicate(artboardPredicate))
    }
    return results
}
function jumpToArtboard(doc, artboard) {
    var page = artboard.parentGroup()
    if (doc.currentPage() != page) {doc.setCurrentPage(page)}
    centerArtboard(doc, artboard)
}
function centerArtboard(doc, targetArtboard) {
    var view = doc.contentDrawView()
    var padding = 0.1 // Relative to of artboard size, 0.1 = 10%
    var targetRect = targetArtboard.rect()
    targetRect.origin.x -= targetRect.size.width * padding
    targetRect.origin.y -= targetRect.size.height * padding
    targetRect.size.width *= 1 + padding * 2
    targetRect.size.height *= 1 + padding * 2
    view.centerRect(targetRect)
}
function showAlert(title, dialog) {
    var app = [NSApplication sharedApplication]
    [app displayDialog: dialog withTitle: title]
}
function javaArrayToObjectiveC(javaArray) {
    var array = NSMutableArray.array()
    for (var i = 0; i < javaArray.length; i++) {
        [array addObject: javaArray[i]]
    }
    return array
}

// Sort
function sortX_FromLeft(a, b) {
    return a.frame().x() - b.frame().x()
}
function sortX_FromRight(a, b) {
    return b.frame().x() - a.frame().x()
}
function sortY_FromTop(a, b) {
    return a.frame().y() - b.frame().y()
}
function sortY_FromBottom(a, b) {
    return b.frame().y() - a.frame().y()
}
function sortFromRight_Top(a, b) {
    var result = sortX_FromRight(a, b)
    if (result == 0) {
        result = sortY_FromTop(a, b)
    }
    return result
}
function sortFromRight_Bottom(a, b) {
    var result = sortX_FromRight(a, b)
    if (result == 0) {
        result = sortY_FromBottom(a, b)
    }
    return result
}
function sortFromLeft_Top(a, b) {
    var result = sortX_FromLeft(a, b)
    if (result == 0) {
        result = sortY_FromTop(a, b)
    }
    return result
}
function sortFromLeft_Bottom(a, b) {
    var result = sortX_FromLeft(a, b)
    if (result == 0) {
        result = sortY_FromBottom(a, b)
    }
    return result
}
