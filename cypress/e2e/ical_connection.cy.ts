describe('iCal Connection E2E Test', () => {
  beforeEach(() => {
    // For a real app, you would mock the login state.
    // For this test, we'll assume the user is logged in and visits the page.
    cy.visit('/calendars'); 
  });

  it('allows a user to add an iCal URL and see it listed on the page', () => {
    const testUrl = 'https://www.airbnb.com/calendar/ical/E2E_TEST_123.ics';

    // 1. Click the "Add Calendar" button to open the dialog
    cy.get('button').contains('Add Calendar').click();

    // 2. Ensure the dialog is visible
    cy.get('h2').contains('Add New Calendar').should('be.visible');

    // 3. Type the iCal URL into the input field
    cy.get('input#ical-url').type(testUrl);

    // 4. Click the "Connect via iCal" button
    cy.get('button').contains('Connect via iCal').click();

    // The dialog should close, and now we look for the new card.
    // NOTE: This test relies on the front-end updating immediately.
    // In a real app with Firestore, there might be a delay.
    // We add a short wait to allow for rendering.
    cy.wait(1000); 

    // 5. Verify the new calendar card is displayed on the page
    cy.get('div[class*="card-description"]').contains(testUrl)
      .should('be.visible')
      .and('contain', testUrl);

    // 6. Check that the platform was correctly identified
    cy.get('div[class*="card-title"]').contains('Airbnb').should('be.visible');
  });
});
