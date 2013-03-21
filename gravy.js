/*
*
*   Gravy is a small form validation callback utility for Backbone.
*
*   (c) 2012 Julian Connor
*
*   Gravy may be freely distributed under the MIT license.
*
*/

Backbone.Gravy = Backbone.View.extend({

    _VERSION : '1.0',

    /*
    * Object of reserved words.
    *
    * This is an object just incase someone wants
    * to have custom default callbacks.
    */
    _r    : { 
        success : "success",
        error   : "error",
        clear   : "clear",
        submit  : "submit"
    },

    /*
    * Used during form submission validation.
    */
    _v    : false,

    /*
    *
    * Helper function to detect if str is reserved for Gravy.
    *
    * @param {String} el
    */
    _reserved : function(el) {
        for (var w in this._r ) {
            if ( el === this._r[w] )
                return true;
        }
        return false;
    },

    /*
    *
    * Validates the value with the appropriate
    * validation method.
    *
    * Returns an object with a summary of the
    * results.
    *
    * @param {String} name
    * @param {String} val
    *
    */
    _validateNode: function(name, val) {
        var gravy   = this.gravy,
            success = null,
            error   = null,
            validator = null,
            optional = false,
            vKey    = gravy[name];

        /*
        *
        * Throw error if validator is not found.
        *
        * Validator can be a String, Function, or Object.
        *
        */
        if ( !(validator = vKey instanceof Object ?
               vKey : (this[vKey] || this.model[vKey])) ) 
            throw new Error("[Gravy] Unable to find validator for: " + name);

        /*
        *
        * If name points to an object, one or more custom rules for field.
        *
        * Check for validation methods in the gravy hash and model
        *
        */
        if ( _.isObject(validator) && !_.isFunction(validator) ) {

            /*
            * If value is optional, return here.
            */
            if ( validator.optional )
                optional = true;


            success = validator.success;
            error   = validator.error;
            validator = validator.validator;

            /*
            * If validator is already a method, do nothing.
            */
            if ( !_.isFunction(validator) ) {
                /*
                * Checks View and Model for validation method.
                */
                validator = this[validator] || this.model[validator];
                if ( !validator )
                    throw new Error("[Gravy] Unable to find validator for: " + name);
            }
        } 

        /*
        *
        * Determine context of validator.
        *
        * If the validator was found in the view, call it from the view, if it
        * was found in the model, call it from the model.
        *
        * This ensures that model methods invoked within the model, access the
        * model rather than the view.
        *
        */
        return {
            result  : (!val && optional) || validator.apply(!!this[vKey] ? this : this.model, [val]),
            success : success || gravy.success || this[this._r.success],
            error   : error   || gravy.error || this[this._r.error]
        };
    },

    /*
    *
    * Applies the appropriate callback based on validation.
    *
    * @param {Object} callback
    * @param {$} node
    *
    */
    _applyCallback: function(callback, node) {
        /*
        *
        * Validates the value of the input and grabs the appropriate
        * success and error callbacks.
        *
        */
        callback = callback.result ? callback.success : callback.error;

        /*
        * Throw error if callback is not a function and Gravy was unable to
        * find callback
        */
        if ( !_.isFunction(callback) && !(callback = this[callback]))
            throw new Error("[Gravy] Unable to find callback: " + callback);

        /*
        *
        * Invokes the callback and passes along the input node.
        *
        */
        return callback.apply(this, [node]);
    },

    /*
    *
    * Default callback for form focusout events.
    *
    * Catches an event and searches the view/model
    * for the appropriate validation method and callback.
    *
    * @param {Event} e
    */
    validate: function(e){
        var callback, clear, node, name, val, gravy, error = null, success = null;

        node  = $(e.target);
        val = e.target.value;
        gravy = this.gravy;

        /*
        *
        * Invoke 'clear' callback if node value is empty.
        *
        * Some trickery used in finding the clear method.
        *       
        * If gravy does not exist in the gravy object and
        * is not a function, try to find the function in 
        * the view.
        *
        * Throw error if unable to find anything.
        *
        */
        if ( !this._v && !val.length ) {
            if ( !(clear = _.isFunction(gravy.clear) ?
                   gravy.clear : this[gravy.clear] || this[this._r.clear]) )
                throw new Error("[Gravy] Unable to find clear callback!");

            return clear.apply(this, [node]);
        }

        name  = e.target.name;

        /*
        *
        * End execution if name is not found in gravy.
        *
        */
        if ( !gravy[name] )
            return console.log("[Gravy] Did not find " + name + " in gravy hash");

        callback = this._validateNode(name,val);

        return this._applyCallback(callback, node);
    },

    /*
    *
    * Catches form submissions, loops through all
    * keys that aren't Gravy reserved words.
    *
    * Validates all fields and invokes callbacks
    * based on results.
    *
    * @param {Event} e
    */
    validateAll: function(e) {
        /*
        * Stop form submission.
        */
        e.preventDefault();

        var valid  = true,
            gravy  = this.gravy, 
            submit = gravy.submit,
            attrs  = {}, callback, val, validator, node;

        this._v = true;

        /*
        *
        * Loop through gravy, if not reserved word invoke validation
        * on that element. Maintain net validation status.
        *
        * Apply the appropriate callback.
        *
        */
        for (var field in gravy ) {
            if ( !this._reserved(field) ) {
                node = this.$("[name='" + field + "']");
                val = node.val();
                
                callback = this._validateNode(field, val);
                
                if ( !callback.result )
                    valid = false;

                attrs[field] = val;
                this._applyCallback(callback, node);
            }
        }

        this._v = false;

        /*
        *
        * If form is not valid and there is no
        * error callback. Do nothing.
        *
        */
        if ( !valid &&
             !((callback = submit.error) &&
               (callback = _.isFunction(callback) ?
                callback : this[submit.error])) )
            return;

        /*
        *
        * If form is valid and there is no
        * success callback. Error.
        *
        * TODO: This is subject to change, may have a scenario where
        * you would want to simply validate the form but not 
        * do anything.
        *
        */
        if ( valid &&
             !((callback = submit.success) &&
               (callback = _.isFunction(callback) ? 
                callback : this[submit.success])) )
            throw new Error("[Gravy] Unable to find submission success callback!");


        return callback.apply(this, [attrs, $(e.target)]);
    }
});
