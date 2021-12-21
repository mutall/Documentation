//
//
import * as outlook from "./outlook.js";
//
//Allows methods on this page to talk to the server
import * as server from "../../../library/v/code/server.js";
//
//Resolve the schema classes, viz.:database, columns, mutall e.t.c. 
import * as schema from "../../../library/v/code/schema.js";
//
//Impor the theme class
import * as theme from "./theme.js";
// 
import { app } from './app.js';
//
//A crud page is a baby whose mother is, e.g., the application page,
//another crud page etc.
export class page extends outlook.baby {
    // 
    constructor(
    //
    //The page that shares the same window as this crud page
    mother, 
    //
    //This is the entity name associated with the 
    //records being administered.
    subject, 
    //
    //These are th permissible operations on the crud page 
    verbs, 
    //
    //This td represents the primary key and its position from where 
    //the administration was initiated.
    //
    //A crud selection is a piece of data that helps to determine
    //the offset of the displayed records.It contains:- 
    //a) the primary key which is useful for this purpose  assuming 
    //that the data is sorted by that key, not  filtered in any way
    //and no deletions have occured.
    //b) the position that is used for updating the original td
    //using the crud result.
    selection) {
        //
        super(mother, app.current.config.crud);
        this.mother = mother;
        this.subject = subject;
        this.selection = selection;
        //
        //For debugging purposes
        this.id = 'crud';
        //
        //Save the verbs if they are not empty otherwise save all the 
        //posible casses
        this.verbs = verbs === (null || undefined)
            ? ["create", "review", "update", "delete"]
            : verbs;
        //
        //Save this as the current crud page for use in expressing event
        //listeners on the crud page. 
        page.current = this;
        //
        //Set the theme panel so that it will be shown when this page is 
        //administered.
        const Theme = new theme.theme(subject, "#content", this, this.selection);
        this.panels.set("theme", Theme);
    }
    //
    //Allow a user to filter and order records in a theme panel.
    async review() {
        //
        //1. Get the theme panel of this page.
        const Theme = this.theme;
        //
        //A. Collect the filter and sorting inputs.
        //
        //Get the condition inputted by the user and convert it to a valid sql.
        const condition = this.get_element('filter').value;
        //
        //Get the sorting clause from the user.
        const clause = this.get_element("sort").value;
        //
        //Do not continue if there are no review inputs.
        if (clause === "" && condition === "")
            return;
        //
        //B. Complete the where and sorting clauses.
        const where = condition === "" ? "" : `where ${condition}`;
        //
        //Get the subject's entity name.
        const ename = this.subject[0];
        //
        //Compile the cpmplete sort clause.
        const sort = clause === ""
            //
            //By default, the sorting order is by ascending primary keys of the
            //subject.
            ? ` order by  ${ename}.${ename}  Asc`
            //
            //Otherwise the user overrides the default value.
            : `order by ${clause}`;
        //
        //C. Use the original sql to formulate a new working version assuming 
        //it has no where or ordering clause.
        //
        //Get the original sql; if there's none ...
        let sql;
        if (Theme.original_sql === null) {
            //
            // ...then use the current theme sql.
            sql = Theme.sql;
            //
            // ... and update the original version.
            Theme.original_sql = Theme.sql;
        }
        else {
            //
            //Otherwise use the original sql.
            sql = Theme.original_sql;
        }
        //
        //C. Update the current sql.
        //
        //Add the condition and the sort clauses to the original_sql.
        Theme.sql = `${sql} ${where} ${sort} `;
        //
        //D. Repaint the theme panel.
        //
        //4.1. Update the maximum records.
        //
        //Get the number of records as Ifuel.
        const count = await server.exec("database", [Theme.dbase.name], "get_sql_data", [`select count(*) as max_record from (${Theme.sql}) as x`]);
        //
        //Set the max records property.
        Theme.max_records = count[0]["max_record"];
        //
        //4.2. Clear table body.
        this.document.querySelector('tbody').innerHTML = "";
        //
        //4.3. Reset the views.
        Theme.view.top = 0;
        Theme.view.bottom = 0;
        //
        //4.4. Go to the first record.
        Theme.goto(0);
    }
    // 
    //Restore the current view, so that click listeners of this view
    //that rely that static variable can work. In general this does nothing;
    //in particular this sets property crud.page.current to this view
    restore_current() { page.current = this; }
    //There are no known checks for validating crud operations 
    check() { return true; }
    // 
    //Return from this crud page the current selection. Our original touhgt was 
    //tthat from a crud page you could return, e.g., what records were deletd, 
    //which ones were modified and the last selectded one. For this version, 
    //we return only the last selected one.
    async get_result() {
        //
        //Get the currently selected tr 
        const tr = this.document.querySelector(".TR");
        // 
        //Prepare for the case where there is no current selection 
        let selection;
        // 
        //If there  is no selected tr then the selection is set to null... 
        if (tr !== null) {
            //
            //...otherwise we compile the selection.
            //
            //Destructure the td ignoring the primary key and the friendly 
            //parts because we will replace them with new editions.
            const { position } = this.selection;
            // 
            //Get the primary key as an auto number
            const pk_selection = tr.getAttribute("pk");
            //
            //If the pk_selection is not a string then something must have gone 
            //wrong; for instance, perhaps the last save was not successful 
            if (typeof pk_selection !== "string") {
                throw new schema.mutall_error(`The primary key for a selected tr not found`);
            }
            // 
            //Convert the primary key from a text to a number.
            const pk = parseInt(pk_selection);
            // 
            //Get the friendly component; there must be one 
            const friendly = tr.getAttribute("friend");
            if (friendly === null) {
                throw new schema.mutall_error(`The friendly component of tr ${pk} is not found`);
            }
            // 
            //Compile a valid selection
            selection = { position, pk, friendly };
        }
        //
        //Prepare to return a null selection
        else {
            selection = null;
        }
        //
        //Compile and return the final crud result without the updates, the additions 
        //and the deletions. They will be considered for future versions
        return { selection };
    }
    //
    //Modify the foreign key field that matches the given button. The function 
    //is asynchronous because it waits for the user to select a new entry 
    //from the foreign key table's crud page.
    async edit_fk(button) {
        //
        //Stop the current tr from being clicked on.
        this.win.event.stopPropagation();
        //
        //Use te button to get the crud page's admistration parameters
        const { subject, verbs, selection } = this.get_admin_parameters(button);
        //
        //Use the admin parameters to create a new crud (baby) page whose
        //mothr is the current page.
        const baby = this.new_crud(this, subject, verbs, selection);
        //
        //Wait for the user to collect crud operation results. The result
        //is undefiend if teh user aborts the administration.
        const result = await baby.administer();
        // 
        //Use the crud result to update this mother page, if it is defined 
        this.update_fk(result);
    }
    //
    //Create the logical crud page .This stub is to allow us to override
    //the normal crud page with our application specific version for
    //various reasons including implementation of quality control
    //features. See the crud constructor for further details
    new_crud(mother, subject, verbs, selection) {
        return new page(mother, subject, verbs, selection);
    }
    //
    //Get the subject verbs and the primary keys of the current theme
    get_admin_parameters(button) {
        //
        //Retrieve the buttons primary key
        const value = button.getAttribute("pk");
        //
        //The primary key must be either a number or undefined.
        let pk;
        if (typeof value === "string") {
            pk = parseInt(value);
        }
        //
        //Retrieve the buttons position
        const td_element = button.parentElement;
        const cellIndex = td_element.cellIndex;
        const rowIndex = td_element.parentElement.rowIndex;
        const position = [rowIndex, cellIndex];
        // 
        //Retrieve the button's friendly component 
        const friendly = button.value;
        // 
        //Compile a td from this button
        const selection = { position, pk, friendly };
        //
        //For this version we assume the user as a service provider 
        //with unlimited crud access to his data 
        const verbs = ["create", "update", "review", "delete"];
        //
        //Get the theme pannel of this crud page 
        const Theme = this.panels.get("theme");
        //
        //Get the column name that matches this button       
        const colname = Theme.col_names[button.parentElement.cellIndex];
        //
        //Get the entity and the database name of this crud page.
        const [ename] = this.subject;
        //
        //Get the actual database column
        const col = Theme.dbase.entities[ename].columns[colname];
        //
        //Formulate the referenced subject 
        const subject = [col.ref.table_name, col.ref.db_name];
        //
        //Return the admin parameters
        return { subject, verbs, selection };
    }
    //
    //Returns the td that houses the given element. 
    static get_td(element) {
        // 
        //There must be a td element in the hierarchy
        if (element === null)
            throw new schema.mutall_error("No td element found in the hierarchy");
        // 
        //Test if the element is a td and return if it is
        if (element instanceof HTMLTableCellElement)
            return element;
        // 
        //Get the parent element
        const parent = element.parentElement;
        // 
        //Return the td of the parent
        return page.get_td(parent);
    }
    //
    //This is an onchange event listener that highlights
    //this field, i.e., td, to indicate that it will be
    //considered for saving.
    static mark_as_edited(evt) {
        //
        //initialize the element.
        let element;
        // 
        //If the element is wat was passed as a parameter continue
        if (evt instanceof HTMLElement) {
            element = evt;
        }
        // 
        //Check if the event target is a html element to avoid the error on 
        //event element.
        else if (evt.target instanceof HTMLElement) {
            element = evt.target;
        }
        // 
        //This event was not caused by a html element 
        else {
            return;
        }
        //
        // 
        //Do nothing if the element is null 
        if (element === null)
            return;
        //
        //Stop any bubblig up
        window.event.stopPropagation();
        //
        //Get the td that houses the element and mark it as edited.
        const td = page.get_td(element);
        td.classList.add("edited");
        //
        //Get the first cell of the row (that contains this td) and 
        //mark it as edited.
        const pri = td.parentElement.children[0];
        pri.classList.add("edited");
        // 
        //Update the output of this io
        const pos = [page.current.theme.key, td.parentElement.rowIndex, td.cellIndex];
        //
        //get the td' io
        const io = theme.theme.ios.get(String(pos));
        //
        //Do the transfer to update inputs
        io.update_outputs();
    }
    //
    //Use the return crud result, typicaly primary key and its friendly name
    //to update this mother page.
    update_fk(result) {
        // 
        //No update is required when crud is aborted
        if (result === undefined)
            return;
        //
        //Update the tr. The update is valid if the user clicked on 
        //the crud's back button to get here, rather the window's 
        //history back button.
        //
        //Destructure the crud result
        const { selection } = result;
        //
        //Prepare for a null selection
        let position, pk, friendly;
        //
        if (selection !== null) {
            // 
            //Assigninig valid selections 
            //
            //Destructure the selection. We do not know why this is not working
            // ( { position, pk, friendly } )= selection;
            position = selection.position;
            friendly = selection.friendly;
            pk = selection.pk;
        }
        else {
            // 
            //For the case of a null selection nullify the foreign key value
            position = this.selection.position;
        }
        //
        //Destructure the position
        const [rowIndex, colIndex] = position;
        //.
        //Get the td field being edited
        const table = this.document.querySelector("table");
        //
        //Get the tr st the row index
        const tr = table.rows[rowIndex];
        //
        //Get the td at the columnl index 
        const td = tr.cells[colIndex];
        //
        //Get the button to be changed
        const input = td.querySelector('input');
        //
        //Update the input button with the new changes
        if (pk !== undefined && friendly !== undefined) {
            input.setAttribute("pk", `${pk}`);
            input.value = friendly;
        }
        // 
        //Mark all the neccesary tds that are affected by this change as 
        //edited.
        //NB THE FIRST TD IN A ROW IS IMPORTANT FOR UPDATING THE CRUD PAGE
        page.mark_as_edited(input);
        //
        //If this is a hierarchical situation update the mother with 
        //updates additions and delete    
    }
    //
    //This is the last crud page opened.
    static get current() {
        //
        //Get the lenght of the stack and it must be greater than 0 
        //if not throw an error 
        const length = page.stack.length;
        if (length === 0) {
            throw new Error("There is no current crud page");
        }
        //
        //Get and return the crud page at top of the stack 
        return page.stack[length - 1];
    }
    //
    //
    static set current(x) {
        page.stack.push(x);
    }
    //
    //A button event listener that adds an empty row above
    //the current selection.
    create_row() {
        //
        //Get the selected tr.
        const tr_selected = this.document.querySelector(".TR");
        //
        //1. Create Element tr above the selected tr if any.
        //
        //1.1. Get the table body.
        const tbody = this.document.querySelector("tbody");
        //
        //1.2. Get the row index to append to; it is this
        //selected row if any otherwise its the first row.
        const rowIndex = tr_selected === null
            ? 0
            : tr_selected.rowIndex;
        //
        //1.3. Insert the row into the table body.
        const tr = tbody.insertRow(rowIndex);
        //
        //2. Create a new tr with no row data
        this.theme.load_tr_element(tr);
    }
    //
    //This is a listener for collecting and saving the affected tds
    //, i.e., both new records and existing old tds, to the database.
    // This is the U component of the CRUD operations.
    async update_database() {
        //
        //Collect all the edited $inputs, i.e., data and their positions
        //on the crud page.
        const questions = [...this.collect_questions()];
        //
        //Write the $inputs to the server database and return the save result, 
        //Imala.
        const Imala = await server.exec(
        //
        //Use the new large table load method
        "questionnaire", 
        //
        //Data in the Iquestionnare format 
        [questions], 
        //
        //Call the load method -- the one specificlly tailord for CRUD
        //"load_user_inputs",
        "load", 
        //
        //Use the default xml and html log files and do not summarise
        //the reult
        []);
        //
        //
        //Use the $result to report on the crud page to show the status 
        //of the save.  
        //this.report(Imala);
        alert(JSON.stringify(Imala));
    }
    // 
    //To avoid repeating ourselves define the theme of this crud page
    get theme() {
        return this.panels.get("theme");
    }
    //
    //Collect all the edited $inputs, i.e., data and its position, and return 
    //each one of them as label layout
    *collect_questions() {
        //
        //Collect all the tds that have data to be sent to the server.
        const tds = Array.from(this.document.querySelectorAll("td.edited"));
        //
        //Loop through all the edited tds and convert each one of them to a 
        //questionnaire label.
        for (let td of tds) {
            //
            //Cast the td to a html table cell element
            //to eliminate typescript errors.
            const td_element = td;
            //
            //Get the cname
            const cname = this.theme.col_names[td_element.cellIndex];
            //
            //Get the tr
            const tr = (td_element.parentNode);
            //
            //Get the row position
            const rowindex = tr.rowIndex;
            //
            //The alias of your data should match the index of your td's row
            const alias = [rowindex];
            //
            //Get the td position
            const cellIndex = td_element.cellIndex;
            //
            //Destructure the subject.
            const [ename, dbname] = this.subject;
            // 
            //Get the io that created that td
            //NB: The Maps array key needs to be converted into a string because
            //typescript doesnt seem accept an object as a key -- unlike PHP 
            const Io = theme.theme.ios.get(String(
            //
            //This is the index of any td in this theme
            [this.theme.key, rowindex, cellIndex]));
            //
            if (Io === undefined)
                throw new Error("Cannot get the io that created this td");
            // 
            //Compile output question as a questionnaire label 
            const label = [
                dbname, ename, alias, cname,
                //
                //The desired expression is an atom, a.k.a., scalar with 
                //position data
                ["capture\\atom", Io.input_value, rowindex, cellIndex]
            ];
            //Yield the explicit label
            yield label;
        }
    }
    //
    //This is an onblur event listener of the textarea,
    //that updates the editted value to that of the input. 
    //In order to trigger the input`s onchange.
    update_textarea_input(textarea) {
        //
        //The input is a child of the parent of the textarea
        const input = textarea.parentElement.querySelector("input");
        //
        //Transfer the textarea content to the input value 
        //
        //Ignore the transfer if there are no changes.
        if (textarea.textContent === null
            || input.value === textarea.textContent)
            return;
        //
        //Commit the changes.
        input.value = textarea.textContent;
        //
        //mark the cell as edited
        input.parentElement.classList.add('edited');
    }
    //
    //This an onclick event listener of the input element that activates 
    //the textarea, for the user to start editting
    edit_textarea(input) {
        //
        //Get the text area which is a child of the parent of the input 
        const textarea = input.parentElement.querySelector("textarea");
        //
        //Transfer the input value to the textarea text content 
        textarea.textContent = input.value;
        //
        //Hide the input 
        input.hidden = true;
        //
        //Unhide the text area 
        textarea.removeAttribute("hidden");
    }
    //Remove the curret record from both the screen and 
    //the database.
    async delete() {
        //
        //Destructure this pages subject to reveal the entity and dbname.
        const [ename, dbname] = this.subject;
        //
        //Get the currently selected tr, if any. 
        const tr = this.document.querySelector(".TR");
        if (tr === null) {
            alert("Please select a row to delete");
            return;
        }
        //
        //Get the primary key of the currently selected record.
        const pk = tr.getAttribute("pk");
        //
        //3. Formulate the delete sql and ensure that the entity name is 
        //enclosed with back ticks.
        const ename_str = `\`${ename}\``;
        const sql = `Delete  from ${ename_str}  where ${ename_str}
        .${ename_str}='${pk}'`;
        //
        //4. Execute the delete query on the server and return the 
        //number of affected records.
        const records = await server.exec("database", [dbname], "query", [sql]);
        //
        //Check if the delete was successful or not.
        if (records !== 1) {
            throw new schema.mutall_error(`The following query was not successful:
             ${sql}`);
        }
        //
        //5. Repaint homepage content to reflect changes, i.e., remove the 
        //row from the table.
        tr.parentNode.removeChild(tr);
    }
    //
    //This method opens a popup, shows the columns that 
    //are already hidden and lets the user select the ones 
    //to be made visible 
    async unhide() {
        //
        //Get the sheet for styling the columns because it is used for
        //controlling the hiding and unhiding feature 
        const element = this.get_element("columns");
        const sheet = element.sheet;
        // 
        //Get the current theme.
        const Theme = this.panels.get("theme");
        //
        //Get the column names of the current theme. 
        let colnames = Theme.col_names;
        //
        //Get the popup choices as key/value pairs of columns to unhide.
        const pairs = this.get_hidden_columns(sheet, colnames, Theme);
        // 
        //
        const specs = this.get_popup_window_specs();
        //
        //Use the pairs to create a multiple choice popup
        const Popup = new outlook.choices(app.current.config.general, pairs, "hidden_column", specs);
        // 
        //Await for the user to pick the choices of column names.
        const choices = await Popup.administer();
        // 
        //Unhide the selected columns.
        choices.forEach(cname => {
            // 
            //Get the index of this column name from the current theme. 
            const i = colnames.indexOf(cname);
            //
            //Get the declaration of the i'th rule 
            const declaration = sheet.cssRules[i].style;
            //
            //remove the display none property
            declaration.removeProperty("display");
            declaration.removeProperty("background-color");
        });
    }
    //
    //Get the popup choices as key/value pairs of columns to unhide.
    get_hidden_columns(sheet, cnames, Theme) {
        // 
        //Filter all the hidden columns
        const fcnames = cnames.filter(cname => {
            // 
            //Get the index of this cname
            const i = cnames.indexOf(cname);
            //
            //Get the i'th rule declaration.
            const declaration = sheet.cssRules[i].style;
            //
            //Get the display property.
            const display = declaration.getPropertyValue("display");
            //
            //If the property is found return true
            return display !== "";
        });
        // 
        //Get the theme's entity name from the subject 
        const ename = Theme.subject[0];
        // 
        //Get the entites columns 
        const columns = Theme.dbase.entities[ename].columns;
        // 
        //Map the filtered column names to key value pairs 
        return fcnames.map(cname => {
            //
            //Get the matching column 
            const col = columns[cname];
            // 
            //The value of a column is its title if it's available.  
            const value = col.title === undefined ? cname : col.title;
            // 
            return { key: cname, value };
        });
    }
    //
    //This will hide the selected column by controlling the styling 
    hide() {
        //
        //1. Get the index of the selected th element
        const index = this.document.querySelector(".TH").cellIndex;
        //
        //2.Retrieve the rule declaration associated with this index
        //    
        //2.1 Retrieve the style tag.
        const style_sheet = this.get_element('columns').sheet;
        //
        //2.1 Retrieve the rule declaration with this index, using a css styling rule
        const declaration = style_sheet.cssRules[index].style;
        //
        //2.2 Change the display property to none
        declaration.setProperty("display", "none");
    }
    //
    //Toggles the checkbox at the primary td allowing user to do multiple 
    //tr selection. 
    multi_select(btn) {
        //
        //Determine whether we are displaying or hiding the multiselector options
        const display = btn.classList.contains("multiselect");
        //    
        //Retrieve the css styling.
        const style_sheet = this.get_element('theme_css').sheet;
        //
        //Hide or show the multiselect option.
        this.update_stylesheet(style_sheet, "multi_select", display);
        //
        //Toggle the multiselector class
        btn.classList.toggle("multiselect");
    }
    //
    //Update the stylesheet so that the given selection is either 
    //hidden or displayed; if hidden the display property of the 
    //matching CSS rule is set to none, otherwise it's removed.
    update_stylesheet(sheet, selection, hide) {
        //
        //Use the selection to find the relevant rule.
        //
        //Convert the rule list (in the stylesheet) to an array.
        const rules = Array.from(sheet.cssRules);
        //
        //Find the index of the rule that matches the selection.
        const index = rules.findIndex((rule1) => rule1.selectorText === `.${selection}`);
        if (index === -1)
            throw new Error(`Rule .${selection} not found`);
        //
        //Use the index to get the rule.
        const rule = rules[index];
        //
        //Add or remove the display property.
        if (hide)
            rule.style.setProperty("display", "none");
        else
            rule.style.removeProperty("display");
    }
    //
    //This is a toggle switch that puts the page in edit or normal mode. You know you 
    //are in the edit mode because of Joyce's cursor. When re-pressed, it 
    //switches to normal mode
    edit_click() {
        //
        //Put the body in edit or normal mode
        this.toggle_edit_normal();
        //
        //Scroll to the curently selected row, if any
        const tr = document.querySelector('.TR');
        //
        //scroll the tr into the center of the view, both vertically and 
        //horizontally
        if (tr !== null)
            tr.scrollIntoView({ block: 'center', inline: 'center' });
    }
    //
    //Toggle the state of this page's body section between the edit and normal
    //modes by changing styling, rather than the actual body 
    toggle_edit_normal() {
        //
        //Get the edit style tag. The crud page must have one
        const style = document.querySelector('#edit_style');
        //
        //Toggle between the edit class and no edit (i.e., normal) modes 
        style.classList.toggle('edit');
        //
        //Select the mode to switch off. For instance, switch off edit if the style
        //is classified as edit
        const mode = style.classList.contains('edit') ? 'edit' : 'normal';
        //
        //Switch off the selected mode
        style.textContent = `.${mode}{display:none;}`;
        //
        //Set the display mode of the theme page. It's the opposite of what we
        //are switching off.
        this.theme.display_mode = mode === "edit" ? "normal" : "edit";
    }
    // 
    //Get the popup's window size and location.
    get_popup_window_specs() {
        //we dont seem to understand what window innerwidth and 
        //innerheight are. 
        //const winh= window.innerhHeight;
        //const winw= window.innerhWidth;
        //
        //We expected the following values for window height
        //$width on kimotho`s machine.
        const winh = 900;
        const winw = 1600;
        //
        //Specify the window location and size.
        const height = 1 / 3 * winh;
        //
        const top_pos = 1 / 2 * winh - 1 / 2 * height;
        //
        const width = 1 / 3 * winw;
        const left = 1 / 2 * winw - 1 / 2 * width;
        //
        //The specifications of the pop up.
        return `width=${width},top=${top_pos},height=${height},left=${left}`;
    }
    //
    //This method makes the error button visible and puts the error in its 
    //(the button's) span tag which allows the user to view the Imala report.
    report(mala) {
        //
        //If syntax alert the error messages.
        if (mala.class_name === "syntax") {
            //
            //Convert the errors to a string.
            const errors = mala.errors.join("\n");
            //
            //Display the errors.
            alert(`There this is a syntax error ${errors}`);
            //
            //Stop code execution.
            return;
        }
        //
        //If runtime loop through the result array to report it. The elements of 
        //the array has the following structure:-
        //['error', ans]|['pk', ans, friend]
        //where 
        //  ans ={class_name:'scalar', value, position?, operation?}
        //and 
        //  position = [rowIndex, colIndex?],
        //  operation = "insert" 
        mala.result.forEach(([Iexp, position]) => {
            //
            //Get the position.
            const [rowIndex, cellIndex] = position;
            //
            //Get the affected tr.
            const tr = this
                .document
                .querySelector("table")
                .rows[rowIndex];
            //
            //Get the affected td.
            const td = tr.cells[cellIndex];
            //
            //Get the error button at that given position
            const error_btn = td.querySelector(".error_btn");
            //
            //Get the span for the error messages
            const errors = td.querySelector(".errors");
            //
            //If the writting was successful we update the primary key attributes 
            //and remove highlights of the edited tds
            if (Iexp.type === "pk") {
                //
                //Get the span for the pk.
                const pk_span = td.querySelector(".pk");
                //
                //Update the primary key.
                pk_span.textContent = String(eval(Iexp.value));
                //
                //Update the friend.
                pk_span.setAttribute("friend", `${Iexp.friend}`);
                //
                //Remove the highlight for all siblings of this tr 
                Array.from(tr.querySelectorAll("td.edited"))
                    .forEach(td2 => td2.classList.remove("edited"));
                //
                //Clear the error button by emptying and hiding it
                error_btn.hidden = true;
                error_btn.textContent = "";
                //
                //Clear the error messages and hide the containing span
                errors.textContent = "";
                errors.hidden = true;
                //
                return;
            }
            //The returned expression is an error.
            //
            //Highlight the whole row to mark it as an error.
            tr.classList.add("report");
            //
            //unhide the error button.
            error_btn.hidden = false;
            //
            //Get the span and paint its text content.
            errors.textContent = Iexp.value;
        });
    }
}
//
//
//This is the stack of all the current crud pages in the order inwhich 
//they were created the most recent is at the top (LIFO).
page.stack = [];
//
//Modelling the tr as the basic unit for CRUD operations. The cud.page
//manages the same CRUD operatins for bulk operations, i.e., 
//creating, reviewing, updating and deleting multiple records at once
export class tr {
    // 
    constructor(
    //
    //The entity and database name associated with this 
    //tr
    crud, 
    //
    //The primary key of this tr
    pk) {
        this.crud = crud;
        this.pk = pk;
    }
    static get current() {
        // 
        //Check whether there is a currrent selection alert
        //user and throw exception if  none 
        if (tr.current__ === undefined) {
            throw new schema.mutall_error("Please select a tr");
        }
        return this.current__;
    }
    // 
    static set current(tr) {
        this.current__ = tr;
    }
}
// 
//Pool of previously selected records 
tr.map = new Map();
//
//Override the normal error logging with an alert.
export class crud_error extends Error {
    constructor(msg) {
        //
        //Compile an error message that redirects the user
        //to the console
        const msg2 = `${msg}.<br> See Console.log for details.`;
        //
        //Update the error tag, assuming we are in the crud page.
        document.querySelector("#error").innerHTML = msg2;
        //
        //Log to the view variable to the console. 
        //Throw the default exception 
        super(msg2);
    }
}
