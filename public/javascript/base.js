var rsslounge = {

    /**
     * global settings
     */
    settings: {},

    /**
     * indicates an drag drop event and supress click
     */
    dragged: false,


    /**
     * contains all unread items per feed given by server
     * will be used by refreshFeeds() for multithreading
     */
    feeds: null,
    
    
    /**
     * first calendar date picked
     */
    calendarPick: false,
    
    
    /**
     * initialize all events
     */
    init: function(newfeed) {
        $(document).ready(function(){
            $('#header h1').click(function() {
                rsslounge.setFeedVisibility();
                rsslounge.refreshList();
            });
        
            // create calendar
            rsslounge.calendar();
            
            // register events
            rsslounge.events.header();
            rsslounge.events.feedlist();
            rsslounge.events.settings();
            rsslounge.events.images();
            rsslounge.events.messages();
            
            // set timeout for ajax refresh
            rsslounge.refresh.timeout(rsslounge.settings.timeout);
            
            // set visible feeds
            rsslounge.setFeedVisibility();
            
            // select current category or feed
            if(rsslounge.settings.starred==1)
                $('#feeds-list .starred').addClass('active');
            else if(rsslounge.settings.selected.length==0)
                $('#cat_0').addClass('active');
            else
                $('#'+rsslounge.settings.selected).addClass('active');
            
            // preload images
            rsslounge.preloadImages(
                'stylesheets/images/mark.png',
                'stylesheets/images/mark-inactive.png',
                'stylesheets/images/star.png',
                'stylesheets/images/star-inactive.png',
                'stylesheets/images/dropup.png',
                'stylesheets/images/dropdown.png',
                'stylesheets/images/edit.png',
                'stylesheets/images/ajax-loader.gif'
            );
            
            // config jGrowl
            $.jGrowl.defaults.position = 'bottom-right';
            $.jGrowl.defaults.life = 7000;
            
            // open new feed dialog
            if($.trim(newfeed).length!=0)
                rsslounge.dialogs.addEditFeed(newfeed);
        });
    },
    
    
    
    //
    // calendar (datepicker)
    //
    
    
    /**
     * initialize the calendar
     */
    calendar: function() {
        $('#calendar').DatePicker({
            flat: true,
            date: [],
            mode: 'range',
            starts: 1,
            onChange: function(date) {
                if(date[0]=="NaN-NaN-NaN")
                    return;
                if(!rsslounge.calendarPick) {
                    rsslounge.calendarPick = true;
                } else {
                    rsslounge.settings.dateStart = date[0];
                    rsslounge.settings.dateEnd = date[1];
                    rsslounge.refreshList();
                    rsslounge.calendarPick = false;
                }
            }
        });
    },
    
    
    
    
    
    //
    // private helper
    //
    
    
    /**
     * preloads given images
     * @param images as string
     */
    preloadImages: function() {
      for(var i = 0; i<arguments.length; i++)
        jQuery("<img>").attr("src", arguments[i]);
    },


    /**
     * show images when open content was clicked
     * don't load the images before
     */
    showImages: function(e) {
        $(e).find('img').each(function(i, self) {
            $(self).attr('src', $(self).attr('ref'));
        });
    },
    
    
    /**
     * returns all ids of messages and images (items)
     * @param action indicates any action for the items (mark as read etc.)
     */
    getVisibleItems: function(action) {
        var ids = new Array();
        
        // collect visible images
        $('#images div').each(function() {
            var id = $(this).attr('id').substr(5);
            if( ($(this).position().top >= $('#images').height()) == false ) { // only handle visible images
                ids[ids.length] = id;
                
                // mark image
                if(action.mark) {
                    $(this).children('.mark-image').removeClass('active');
                
                // remove image
                } else if(action.remove) {
                    $(this).fadeOut('slow',function() {
                        $(this).remove();
                        if($('#images').children().length == 1)
                            $('#images').fadeOut('slow');
                    });
                    
                // unstarr image
                } else if(action.unstarr) {
                    $(this).children('.starr-image').removeClass('active');
                }
            }
        });
        
        // collect all messages
        $('#messages li').each(function() {
            ids[ids.length] = $(this).attr('id').substr(5);
            
            // mark message
            if(action.mark) {
                $(this).children('.mark-message').removeClass('active');
                $(this).removeClass('unread');
            
            // unstarr message
            } else if(action.unstarr) {
                $(this).children('.starr-message').removeClass('active');
            }
        });

        return ids;
    },
    
    
    /**
     * returns an array of id value pairs of all form elements in given element
     * @param element containing the form elements
     */
    getValues: function(element) {
        var values = {};
        
        // get all input elements
        $(element).find(':input').each(function (i, el) {
            // get only input elements with id
            if($.trim($(el).attr('id')).length!=0) {
                // save value for return
                values[$(el).attr('id')] = $(el).val();
                
                // special save for checkboxes
                if($(el).attr('type')=='checkbox')
                    values[$(el).attr('id')] = $(el).attr('checked') ? 1 : 0;
            }
        });
        
        // return all values
        return values;
    },
    
    
    /**
     * insert error messages in form
     * @param form target where input fields in
     * @param errors an array with all error messages
     */
    showErrors: function(form, errors) {
        $('span.error').remove();
        $.each(errors, function(key, val) {
            form.find('#'+key).parent('li').append('<span class="error">'+val+'</span>');
        });
    },
    
    
    /**
     * updates or inserts a given feeds in feed list
     * @param feed the feed for update or insertion
     */
    updateFeed: function(feed) {
        
        // remove old feed
        $('#feed_'+feed.id).remove();
        
        // insert new feed
        if(feed.position==0)
            // first element of the category
            $('#cat_'+feed.category).next('ul').prepend(feed.html);
        else 
            // inside the category
            $('#cat_'+feed.category).next('ul').find('li:eq('+(feed.position-1)+')').after(feed.html);
        
        // bind events
        rsslounge.events.feedlist();
    },
    
    
    /**
     * refresh unread items of categories
     * @param categories, an array of categories
     */
    refreshCategories: function(categories) {
        // remove all unread items counter
        $('#feeds-list h3').each(function(i, item) {
            $(this).find('.items').html('');
            $(this).removeClass('unread');
        });
        
        // set unread items
        $.each(categories, function(key, unread) {
            var cat = $('#cat_'+key);
            cat.find('.items').html(unread);
            if(unread>0)
                cat.addClass('unread');
            else
                cat.removeClass('unread');
        });
        
        // set stats at bottom
        rsslounge.refreshStats({
            unread: categories[0]
        });
    },
    
    
    /**
     * refresh unread items of feeds
     * @param feeds, an array of feeds
     */
    refreshFeeds: function(feeds) {
        rsslounge.feeds = feeds;
        window.setTimeout('rsslounge.refreshFeedsExecute()',0);
    },
    
    
    /**
     * executes the refresh feeds
     * for execution with window.setTimeout for
     * performance optimization (new thread)
     * @param feeds, an array of feeds
     */
    refreshFeedsExecute: function() {
        $('#feeds-list li a.feed span').html('');
        $('#feeds-list li').removeClass('unread');
        
        $.each(rsslounge.feeds, function(key, unread) {
            var feed = $('#feed_'+key);
            feed.find('a.feed span').html('('+unread+')');
            if(unread>0)
                feed.addClass('unread');
            else
                feed.removeClass('unread');
        });
    },
    
    
    /**
     * refresh stats at the bottom of the page
     * @param values
     */
    refreshStats: function(values) {
        if(typeof values.unread != 'undefined')
            $('#stats .unread').html(values.unread);
            
        if(typeof values.all != 'undefined')
            $('#stats .all').html(values.all);
            
        if(typeof values.feeds != 'undefined')
            $('#stats .feeds').html(values.feeds);
        
        // update read items
        $('#stats .read').html( parseInt($('#stats .all').html()) - parseInt($('#stats .unread').html()));
    },
    
    
    /**
     * update settings with new values
     * @param settings object with new settings
     */
    updateSettings: function(settings) {
        $.extend(rsslounge.settings, settings);
    },
    
    
    /**
     * refresh main list of feed content
     */
    refreshList: function() {
    
        // fade list
        $('#images, #messages, #noentries').fadeTo('normal', 0.5);
        
        // don't save offset
        rsslounge.settings.offset = 0;

        $.ajax({
            type: "POST",
            url: "item/list",
            data: rsslounge.settings,
            dataType: 'json',
            success: function(response){
                // error
                if(typeof response.error != 'undefined')
                    rsslounge.showError(response.error);
                else {
                    $('#items').html(response.html);
                    
                    // set stats at bottom
                    rsslounge.refreshStats({
                        all: response.all,
                        feeds: response.countfeeds
                        // unread will be updated via refreshCategories
                    });
                    
                    // refresh unread items
                    rsslounge.refreshFeeds(response.feeds);
                    rsslounge.refreshCategories(response.categories);
                    
                    // refresh starred items
                    $('#feeds-list h3.starred').find('.items').html(response.starred);
                    
                    // reset events
                    rsslounge.events.images();
                    rsslounge.events.messages();
                }
            }
        });
    },
    
    
    /**
     * shows an error message
     * @param err the error message
     */
    showError: function(err, sticky) {
        if(typeof sticky == 'undefined')
            $.jGrowl(err);
        else
            $.jGrowl(err, { 'sticky': true });
    },
    
    
    /**
     * star an item
     */
    starItem: function () {
        if($(this).hasClass('starr-image'))
            var id = $(this).parent('div').attr('id').substr(5);
        else
            var id = $(this).parent('li').attr('id').substr(5);
    
        $.ajax({
        type: "POST",
        url: "item/star",
        data: { 'id': id },
        dataType: 'json',
        success: function(response){
                // error
                if(typeof response.error != 'undefined')
                    rsslounge.showError(response.error);
                
                // success: update starred items
                else 
                    $('#feeds-list h3.starred').find('.items').html(response.starred);
            }
        });
        
        $(this).toggleClass('active');
    },
    
    
    /**
     * save open categories
     */
    saveOpenCategories: function() {
        if(rsslounge.settings.saveOpenCategories==1) {
            // collect open categories
            var categories = '';
            $('h3').each(function(i, item) {
                if($(item).find('a').hasClass('up'))
                    categories = categories + ',' + $(item).attr('id').substr(4);
            });
            if(categories.length>0)
                categories = categories.substr(1);
            
            // save
            $.ajax({
                type: "POST",
                url: "category/open",
                data: { 'openCategories': categories },
                dataType: 'json'
            });
        }
    },
    
    
    /**
     * check no items
     */
    checkNoItems: function() {
        if($('#images').length == 0 && $('#messages > li:not(.more)').length == 0)
            rsslounge.showAllItems();
    },

    
    /**
     * show all items (remove unread filter 
     * and select all feeds)
     */
    showAllItems: function() {
        // select all
        $('#view .unread').toggleClass('active');
        $('#view .all').toggleClass('active');
        rsslounge.settings.unread = 0;
        
        // load all
        $('#cat_0').click();
    },
    
    
    /**
     * hides or shows all feeds
     * which fits for the current settings
     */
    setFeedVisibility: function() {
        // I don't know why, but this fixes a crazy bug in Opera 9.64
        $('#feeds-list li').each(function(i, item) {
            $(this).removeClass('bla');
        });
        
        // hide all feeds
        $('#feeds-list ul li').hide();
        
        // show allowed priority range
        for(var i=rsslounge.settings.currentPriorityStart; i<=rsslounge.settings.currentPriorityEnd; i++)
            $('#feeds-list .prio'+i).show();
        
        // hide feeds with wrong type
        if(rsslounge.settings.view=="messages")
            $('#feeds-list .multimedia').hide();
        else if(rsslounge.settings.view=="multimedia")
            $('#feeds-list .message').hide();
    }
    
};