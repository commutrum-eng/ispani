const supabase = require('../../config/supabase');

const organizationsController = {
  // Create a new organization
  createOrganization: async (req, res) => {
    try {
      const { name } = req.body;
      const { data, error } = await supabase
        .from('organizations')
        .insert([{ name }])
        .select();

      if (error) throw error;
      res.status(201).json(data[0]);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all organizations
  getOrganizations: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*');

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get an organization by ID
  getOrganizationById: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Organization not found' });
    }
  },

  // Update an organization
  updateOrganization: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const { data, error } = await supabase
        .from('organizations')
        .update({ name, updated_at: new Date() })
        .eq('id', id)
        .select();

      if (error) throw error;
      res.json(data[0]);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Delete an organization
  deleteOrganization: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ message: 'Organization deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};

module.exports = organizationsController;
