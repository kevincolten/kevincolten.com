Backbone.ProfileView = Backbone.Layout.extend({
    template: 'ProfileTemplate.html',

    beforeRender: function()
    {
        this.setView('#profile-detail', new Backbone.ResumeView());
    },

    afterRender: function()
    {
        this.$('.parallax').parallax();
    }
});
